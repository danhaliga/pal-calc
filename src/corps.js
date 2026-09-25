'use strict';
/* CRUD corpuri + endpoint-ul de piese (cu campuri ascunse pentru corpurile neplatite). */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const credit = require('./credit');
const util = require('./util');

const router = express.Router();

/* ---- acces ---- */

/* Corpul altui utilizator se comporta ca inexistent: 404, nu 403. */
function getOwned(id, userId) {
  const corp = db.prepare('SELECT * FROM corps WHERE id = ?').get(Number(id));
  if (!corp || corp.user_id !== userId) return null;
  return corp;
}

function notFound(next) {
  const err = new Error('Corpul nu există.');
  err.status = 404;
  next(err);
}

function parseParams(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Object.assign(PalCalc.defaults(), data);
}

function rowToCorp(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    paid: row.status === 'paid',
    paid_at: row.paid_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    params: parseParams(row.params)
  };
}

/* Piesele trimise catre browser. Pentru un corp draft, campurile platite
   (TL, Tl, c) nu parasesc serverul. */
function piecesFor(corp) {
  const params = parseParams(corp.params);
  const res = PalCalc.calc(params);
  const paid = corp.status === 'paid';

  const pieces = res.P.map(p => {
    const base = {
      nume: p.nume, buc: p.buc, L: p.L, l: p.l,
      fibra: p.fibra, nota: p.nota, boxes: p.boxes
    };
    if (paid) { base.c = p.c; base.TL = p.TL; base.Tl = p.Tl; }
    return base;
  });

  return {
    paid,
    pieces,
    warn: res.warn,
    interior: { Wint: res.Wint, Hint: res.Hint, Dint: res.Dint },
    balamale: res.usi.map(u => ({ L: u.L, H: u.H, n: PalCalc.balamale(u.H) }))
  };
}

/* ---- pagini ---- */

router.get('/corps', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, o.name AS order_name
    FROM corps c LEFT JOIN orders o ON o.id = c.order_id
    WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC
  `).all(req.user.id);

  res.render('corps/index', {
    title: 'Toate corpurile',
    corps: rows.map(r => Object.assign(rowToCorp(r), { orderName: r.order_name, orderId: r.order_id })),
    priceLei: (credit.pretCorp() / 100).toFixed(2),
    justPaid: req.query.paid === '1'
  });
});

/* catalogul de modele: pasul dinaintea creării unui corp */
router.get('/corps/new', requireAuth, (req, res) => {
  const models = PalModels.MODELS.map(m => {
    const params = PalModels.paramsFor(m.id);
    return {
      id: m.id, cat: m.cat, nume: m.nume, descriere: m.descriere,
      params,
      rezumat: PalModels.rezumat(params),
      sketch: PalModels.sketch(params)
    };
  });

  res.render('corps/new', {
    title: 'Alege un model',
    categories: PalModels.CATEGORIES,
    models
  });
});

/* Corp în afara unei comenzi. Costă la fel ca unul dintr-o comandă:
   creditul se consumă la creare, nu la deblocare. */
const creeazaCorp = db.transaction((userId, params, cost) => {
  const ramas = credit.scade(userId, cost, 'corp', null, 'corp fără comandă');
  if (ramas === null) throw new Error('CREDIT_INSUFICIENT');
  const info = db.prepare(
    'INSERT INTO corps (user_id, name, params, status) VALUES (?, ?, ?, ?)'
  ).run(userId, params.nume, JSON.stringify(params), 'paid');
  const corpId = Number(info.lastInsertRowid);
  db.prepare('UPDATE credit_tx SET ref = ? WHERE id = (SELECT MAX(id) FROM credit_tx WHERE user_id = ?)')
    .run(String(corpId), userId);
  return corpId;
});

router.post('/corps', requireAuth, (req, res, next) => {
  const fromModel = req.body.model ? PalModels.paramsFor(String(req.body.model)) : null;
  const params = fromModel || PalCalc.defaults();
  params.nume = (req.body.name || params.nume || 'Corp nou').toString().trim().slice(0, 80);

  try {
    res.redirect(`/corps/${creeazaCorp(req.user.id, params, credit.pretCorp())}`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

router.get('/corps/:id', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);

  const order = corp.order_id
    ? db.prepare('SELECT id, name FROM orders WHERE id = ?').get(corp.order_id)
    : null;

  res.render('corps/edit', {
    title: corp.name,
    corp: rowToCorp(corp),
    order,
    priceLei: (credit.pretCorp() / 100).toFixed(2),
    sold: credit.sold(req.user.id),
    paymentDriver: process.env.PAYMENT_DRIVER || 'fake',
    justPaid: req.query.paid === '1'
  });
});

/* Copia unui corp costă la fel ca un corp nou: fiecare corp dintr-o comandă
   se plătește, chiar dacă același model a mai fost folosit altundeva.
   Copia rămâne în comanda originalului, cu materialele lui. */
const dupliceazaCorp = db.transaction((userId, corp, params, cost) => {
  const ramas = credit.scade(userId, cost, 'corp', null,
    corp.order_id ? 'copie de corp în comandă' : 'copie de corp');
  if (ramas === null) throw new Error('CREDIT_INSUFICIENT');

  const poz = corp.order_id
    ? db.prepare('SELECT COALESCE(MAX(poz), 0) AS m FROM corps WHERE order_id = ?').get(corp.order_id).m + 1
    : 0;

  const info = db.prepare(
    'INSERT INTO corps (user_id, order_id, name, params, status, poz, mat_corp_id, mat_front_id) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, corp.order_id, params.nume, JSON.stringify(params), 'paid', poz,
        corp.mat_corp_id, corp.mat_front_id);

  const corpId = Number(info.lastInsertRowid);
  db.prepare('UPDATE credit_tx SET ref = ? WHERE id = (SELECT MAX(id) FROM credit_tx WHERE user_id = ?)')
    .run(String(corpId), userId);
  return corpId;
});

router.post('/corps/:id/duplicate', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);

  const params = parseParams(corp.params);
  params.nume = `${corp.name} (copie)`.slice(0, 80);

  try {
    res.redirect(`/corps/${dupliceazaCorp(req.user.id, corp, params, credit.pretCorp())}`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

/* ---- API ---- */

const putSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  params: z.record(z.any())
});

router.put('/api/corps/:id', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);

  const body = putSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Date invalide.', issues: body.error.issues });
  }

  const merged = Object.assign(PalCalc.defaults(), parseParams(corp.params), body.data.params);
  const parsed = PalCalc.paramsSchema.safeParse(merged);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Parametri invalizi.',
      issues: parsed.error.issues.map(i => ({ camp: i.path.join('.'), mesaj: i.message }))
    });
  }

  const name = (body.data.name || parsed.data.nume || corp.name).toString().trim().slice(0, 80);
  parsed.data.nume = name;

  db.prepare(
    "UPDATE corps SET name = ?, params = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, JSON.stringify(parsed.data), corp.id);

  res.json({ ok: true, name, params: parsed.data, savedAt: new Date().toISOString() });
});

router.delete('/api/corps/:id', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);
  db.prepare('DELETE FROM corps WHERE id = ?').run(corp.id);
  res.json({ ok: true });
});

router.get('/api/corps/:id/pieces', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);
  res.json(piecesFor(corp));
});

/* ---- export CSV (doar corpuri platite) ---- */

router.get('/corps/:id/export.csv', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);
  if (corp.status !== 'paid') {
    const err = new Error('Lista de debitare este disponibilă după plată.');
    err.status = 402;
    return next(err);
  }

  const params = parseParams(corp.params);
  const body = PalCalc.csv([params]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', util.dispozitieAtasament('debitare-' + corp.name));
  res.send('﻿' + body); /* BOM, ca Excel sa deschida corect diacriticele */
});

/* Deblocarea unui corp mai vechi, rămas în starea draft: se plătește din credit. */
const deblocheaza = db.transaction((userId, corpId, cost) => {
  const ramas = credit.scade(userId, cost, 'corp', corpId, 'deblocare corp');
  if (ramas === null) throw new Error('CREDIT_INSUFICIENT');
  db.prepare(
    "UPDATE corps SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')), " +
    "updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(corpId, userId);
});

router.post('/corps/:id/pay', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);
  if (corp.status === 'paid') return res.redirect(`/corps/${corp.id}`);

  try {
    deblocheaza(req.user.id, corp.id, credit.pretCorp());
    res.redirect(`/corps/${corp.id}?paid=1`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

module.exports = { router, getOwned, piecesFor, parseParams };
