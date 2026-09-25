'use strict';
/* Materialele unei comenzi: decorul plăcii, grosimea și cele două canturi.
   O comandă poate avea oricâte (corp alb, fronturi stejar, spate PFL etc.). */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const Catalog = require('../shared/catalog');

const router = express.Router();

const ROLURI = [
  { id: 'corp', nume: 'Carcasă' },
  { id: 'front', nume: 'Fronturi (uși, sertare)' },
  { id: 'sertar', nume: 'Cutii de sertar' },
  { id: 'liber', nume: 'Altceva' }
];

/* grosimile de cant acceptate, când decorul nu are lista lui în catalog */
const CANT_STANDARD = [0.4, 0.8, 1, 1.3, 1.5, 2];

const schema = z.object({
  nume: z.string().trim().min(1, 'Dă un nume materialului.').max(60),
  rol: z.enum(['corp', 'front', 'sertar', 'liber']),
  brand: z.string().trim().min(1).max(40),
  decor_cod: z.string().trim().max(60).optional().or(z.literal('')),
  pal_mm: z.coerce.number().min(3).max(60),
  cant_gros: z.coerce.number().min(0).max(5),
  cant_subtire: z.coerce.number().min(0).max(5),
  cant_decor_cod: z.string().trim().max(60).optional().or(z.literal(''))
});

function aleComenzii(orderId) {
  return db.prepare('SELECT * FROM order_materials WHERE order_id = ? ORDER BY poz, id').all(orderId);
}

function implicit(materiale, rol) {
  return materiale.filter(m => m.rol === rol)[0] || materiale[0] || null;
}

/* materialul folosit pentru fiecare rol, cu căderea pe carcasă dacă lipsește */
function peRoluri(materiale) {
  const corp = implicit(materiale, 'corp');
  return {
    corp,
    front: implicit(materiale, 'front') || corp,
    sertar: implicit(materiale, 'sertar') || corp
  };
}

function detaliiDecor(brand, cod) {
  const d = cod ? Catalog.decor(brand, cod) : null;
  return {
    decor_cod: d ? d.cod : (cod || null),
    decor_nume: d ? d.nume : null,
    hex: d ? d.hex : null
  };
}

function creeaza(orderId, date) {
  const poz = db.prepare('SELECT COALESCE(MAX(poz), 0) AS m FROM order_materials WHERE order_id = ?')
                .get(orderId).m + 1;
  const d = detaliiDecor(date.brand, date.decor_cod);
  const cantD = detaliiDecor(date.brand, date.cant_decor_cod || date.decor_cod);

  const info = db.prepare(`
    INSERT INTO order_materials (order_id, poz, nume, rol, brand, decor_cod, decor_nume, hex,
                                 pal_mm, cant_gros, cant_subtire, cant_decor_cod, cant_decor_nume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, poz, date.nume, date.rol, Catalog.numeMarca(date.brand),
         d.decor_cod, d.decor_nume, d.hex,
         date.pal_mm, date.cant_gros, date.cant_subtire,
         cantD.decor_cod, cantD.decor_nume);
  return Number(info.lastInsertRowid);
}

/* ---------- catalogul, pentru selectorul din pagină ---------- */

router.get('/api/catalog', requireAuth, (req, res) => {
  const brand = Catalog.numeMarca(req.query.brand || 'Egger');
  const q = String(req.query.q || '');
  const lista = Catalog.cauta(brand, q, 400).map(d => ({
    cod: d.cod, nume: d.nume, hex: d.hex, grup: d.grup, nou: !!d.nou,
    gros: (d.gros || []).map(g => g[0]),
    cant: Catalog.grosimiCant(brand, d.cod).map(c => c.mm)
  }));

  res.json({
    brand,
    marci: Catalog.MARCI,
    grupuri: Catalog.grupuri(brand),
    cantStandard: CANT_STANDARD,
    total: Catalog.decoruri(brand).length,
    decoruri: lista
  });
});

/* ---------- rute pe o comandă ---------- */

function comandaProprie(req, res, next) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!o || o.user_id !== req.user.id) {
    const err = new Error('Comanda nu există.');
    err.status = 404;
    return next(err);
  }
  req.comanda = o;
  next();
}

router.post('/orders/:id/materials', requireAuth, comandaProprie, (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.issues[0].message);
    err.status = 400;
    return next(err);
  }
  creeaza(req.comanda.id, parsed.data);
  res.redirect(`/orders/${req.comanda.id}#materiale`);
});

router.post('/orders/:id/materials/:matId', requireAuth, comandaProprie, (req, res, next) => {
  const mat = db.prepare('SELECT * FROM order_materials WHERE id = ? AND order_id = ?')
                .get(Number(req.params.matId), req.comanda.id);
  if (!mat) return next(Object.assign(new Error('Material inexistent.'), { status: 404 }));

  if (req.body.sterge === '1') {
    const cate = db.prepare('SELECT COUNT(*) AS n FROM order_materials WHERE order_id = ?')
                   .get(req.comanda.id).n;
    if (cate <= 1) {
      return next(Object.assign(new Error('Comanda trebuie să aibă cel puțin un material.'), { status: 400 }));
    }
    db.prepare('DELETE FROM order_materials WHERE id = ?').run(mat.id);
    return res.redirect(`/orders/${req.comanda.id}#materiale`);
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return next(Object.assign(new Error(parsed.error.issues[0].message), { status: 400 }));
  }
  const d = parsed.data;
  const dec = detaliiDecor(d.brand, d.decor_cod);
  const cantD = detaliiDecor(d.brand, d.cant_decor_cod || d.decor_cod);

  db.prepare(`
    UPDATE order_materials SET nume = ?, rol = ?, brand = ?, decor_cod = ?, decor_nume = ?, hex = ?,
           pal_mm = ?, cant_gros = ?, cant_subtire = ?, cant_decor_cod = ?, cant_decor_nume = ?
     WHERE id = ?
  `).run(d.nume, d.rol, Catalog.numeMarca(d.brand), dec.decor_cod, dec.decor_nume, dec.hex,
         d.pal_mm, d.cant_gros, d.cant_subtire, cantD.decor_cod, cantD.decor_nume, mat.id);

  res.redirect(`/orders/${req.comanda.id}#materiale`);
});

module.exports = { router, aleComenzii, peRoluri, creeaza, implicit, ROLURI, CANT_STANDARD };
