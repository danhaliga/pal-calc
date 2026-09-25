'use strict';
/* Comenzi: materialul ales, corpurile din comandă și listele de producție. */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const credit = require('./credit');
const util = require('./util');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalRaport = require('../shared/raport');

const router = express.Router();

const BRANDS = [
  { id: 'egger', nume: 'Egger' },
  { id: 'kronospan', nume: 'Kronospan' }
];
const CANTURI = [0.4, 0.8, 1, 2];
const GROSIMI_PAL = [16, 18, 25];

const schema = z.object({
  name: z.string().trim().min(1, 'Dă un nume comenzii.').max(80),
  brand: z.enum(['egger', 'kronospan']),
  decor: z.string().trim().max(80).optional().or(z.literal('')),
  cant_decor: z.string().trim().max(80).optional().or(z.literal('')),
  pal_mm: z.coerce.number().refine(v => GROSIMI_PAL.includes(v), 'Grosime de PAL neacceptată.'),
  cant_gros: z.coerce.number().refine(v => CANTURI.includes(v), 'Grosime de cant neacceptată.'),
  cant_subtire: z.coerce.number().refine(v => CANTURI.includes(v), 'Grosime de cant neacceptată.'),
  adaos_cant: z.coerce.number().min(10).max(50),
  note: z.string().trim().max(500).optional().or(z.literal(''))
});

/* ---------- acces ---------- */

function getOwned(id, userId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));
  return (!o || o.user_id !== userId) ? null : o;
}

function notFound(next) {
  const err = new Error('Comanda nu există.');
  err.status = 404;
  next(err);
}

function corpuriComenzii(orderId) {
  return db.prepare('SELECT * FROM corps WHERE order_id = ? ORDER BY poz, id').all(orderId)
    .map(row => ({
      id: row.id,
      name: row.name,
      poz: row.poz,
      params: Object.assign(PalCalc.defaults(), JSON.parse(row.params))
    }));
}

function raportComenzii(order) {
  return PalRaport.raport(order, corpuriComenzii(order.id), { effortMs: 250 });
}

/* ---------- lista de comenzi ---------- */

router.get('/orders', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, (SELECT COUNT(*) FROM corps c WHERE c.order_id = o.id) AS nrCorpuri
    FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC
  `).all(req.user.id);

  res.render('orders/index', {
    title: 'Comenzile mele',
    comenzi: rows,
    brands: BRANDS,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp()
  });
});

router.get('/orders/new', requireAuth, (req, res) => {
  res.render('orders/new', {
    title: 'Comandă nouă',
    brands: BRANDS, canturi: CANTURI, grosimi: GROSIMI_PAL,
    values: { name: '', brand: 'egger', decor: '', cant_decor: '',
              pal_mm: 18, cant_gros: 2, cant_subtire: 0.4, adaos_cant: 15, note: '' },
    error: null
  });
});

router.post('/orders', requireAuth, (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('orders/new', {
      title: 'Comandă nouă',
      brands: BRANDS, canturi: CANTURI, grosimi: GROSIMI_PAL,
      values: req.body, error: parsed.error.issues[0].message
    });
  }
  const d = parsed.data;
  const info = db.prepare(`
    INSERT INTO orders (user_id, name, brand, decor, cant_decor, pal_mm, cant_gros, cant_subtire, adaos_cant, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, d.name, d.brand, d.decor || null, d.cant_decor || null,
         d.pal_mm, d.cant_gros, d.cant_subtire, d.adaos_cant, d.note || null);

  res.redirect(`/orders/${info.lastInsertRowid}`);
});

/* ---------- o comandă ---------- */

router.get('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order);

  res.render('orders/show', {
    title: order.name,
    order, raport,
    brands: BRANDS, canturi: CANTURI, grosimi: GROSIMI_PAL,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp(),
    adaugat: req.query.adaugat === '1'
  });
});

router.post('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.issues[0].message);
    err.status = 400;
    return next(err);
  }
  const d = parsed.data;
  db.prepare(`
    UPDATE orders SET name = ?, brand = ?, decor = ?, cant_decor = ?, pal_mm = ?,
           cant_gros = ?, cant_subtire = ?, adaos_cant = ?, note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(d.name, d.brand, d.decor || null, d.cant_decor || null, d.pal_mm,
         d.cant_gros, d.cant_subtire, d.adaos_cant, d.note || null, order.id);

  /* materialul comenzii se aplică tuturor corpurilor, ca listele să fie coerente */
  if (req.body.aplica_material === '1') {
    const corpuri = db.prepare('SELECT * FROM corps WHERE order_id = ?').all(order.id);
    const upd = db.prepare("UPDATE corps SET params = ?, updated_at = datetime('now') WHERE id = ?");
    db.transaction(() => {
      corpuri.forEach(c => {
        const p = Object.assign(PalCalc.defaults(), JSON.parse(c.params));
        p.t = d.pal_mm; p.cg = d.cant_gros; p.cs = d.cant_subtire;
        upd.run(JSON.stringify(p), c.id);
      });
    })();
  }

  res.redirect(`/orders/${order.id}`);
});

router.post('/orders/:id/delete', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);
  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  res.redirect('/orders');
});

/* ---------- adăugarea unui corp (aici se consumă creditul) ---------- */

router.get('/orders/:id/corp-nou', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const models = PalModels.MODELS.map(m => {
    const params = PalModels.paramsFor(m.id);
    return {
      id: m.id, cat: m.cat, nume: m.nume, descriere: m.descriere,
      params, rezumat: PalModels.rezumat(params), sketch: PalModels.sketch(params)
    };
  });

  res.render('corps/new', {
    title: 'Adaugă un corp',
    categories: PalModels.CATEGORIES,
    models, order,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp()
  });
});

const adaugaCorp = db.transaction((userId, order, params, cost) => {
  const ramas = credit.scade(userId, cost, 'corp', null,
    'corp în comanda „' + order.name + '”');
  if (ramas === null) throw new Error('CREDIT_INSUFICIENT');

  const poz = db.prepare('SELECT COALESCE(MAX(poz), 0) AS m FROM corps WHERE order_id = ?')
                .get(order.id).m + 1;
  const info = db.prepare(
    'INSERT INTO corps (user_id, order_id, name, params, status, poz) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, order.id, params.nume, JSON.stringify(params), 'paid', poz);

  const corpId = Number(info.lastInsertRowid);
  db.prepare('UPDATE credit_tx SET ref = ? WHERE id = (SELECT MAX(id) FROM credit_tx WHERE user_id = ?)')
    .run(String(corpId), userId);
  return corpId;
});

router.post('/orders/:id/corps', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const params = req.body.model ? PalModels.paramsFor(String(req.body.model)) : PalCalc.defaults();
  if (!params) {
    const err = new Error('Model necunoscut.');
    err.status = 400;
    return next(err);
  }

  /* materialul vine din comandă, nu din model */
  params.t = order.pal_mm;
  params.cg = order.cant_gros;
  params.cs = order.cant_subtire;

  try {
    const corpId = adaugaCorp(req.user.id, order, params, credit.pretCorp());
    res.redirect(`/corps/${corpId}`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

/* ---------- listele de producție ---------- */

const PRINTURI = {
  corpuri: { view: 'orders/print-corpuri', titlu: 'Listă corpuri' },
  debitare: { view: 'orders/print-debitare', titlu: 'Listă piese pentru debitare' },
  montaj: { view: 'orders/print-montaj', titlu: 'Fișe de montaj' },
  cnc: { view: 'orders/print-cnc', titlu: 'Prelucrări CNC' }
};

router.get('/orders/:id/print/:tip', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cfg = PRINTURI[req.params.tip];
  if (!cfg) return notFound(next);

  const raport = raportComenzii(order);
  res.render(cfg.view, {
    title: cfg.titlu + ' – ' + order.name,
    titlu: cfg.titlu,
    order, raport,
    planse: PalRaport.planseCnc,
    brandNume: (BRANDS.find(b => b.id === order.brand) || {}).nume || order.brand,
    print: true
  });
});

/* ---------- export CSV pentru fabrică ---------- */

router.get('/orders/:id/export.csv', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order);
  const head = ['Corp', 'Cod', 'Piesa', 'Buc', 'Taiere L', 'Taiere l', 'Material',
                'Cant L1', 'Cant L2', 'Cant l1', 'Cant l2', 'Fibra', 'CNC', 'Nota'];
  const linii = [head.join(';')];

  raport.piese.forEach(p => {
    linii.push([
      p.corpNume, p.cod, p.nume, p.buc, p.TL, p.Tl, p.material.tip + ' ' + p.material.gros,
      p.cant.muchii[0], p.cant.muchii[1], p.cant.muchii[2], p.cant.muchii[3],
      p.fibra, p.cnc ? 'DA' : '', p.nota
    ].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', util.dispozitieAtasament('debitare-' + order.name));
  res.send('﻿' + linii.join('\n'));
});

module.exports = { router, getOwned, corpuriComenzii, raportComenzii, BRANDS, CANTURI, GROSIMI_PAL };
