'use strict';
/* CRUD corpuri + endpoint-ul de piese (cu campuri ascunse pentru corpurile neplatite). */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const PalCalc = require('../shared/calc');

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
  const rows = db.prepare(
    'SELECT * FROM corps WHERE user_id = ? ORDER BY updated_at DESC, id DESC'
  ).all(req.user.id);

  res.render('corps/index', {
    title: 'Corpurile mele',
    corps: rows.map(rowToCorp),
    priceLei: (Number(process.env.PRICE_PER_CORP_CENTS || 1500) / 100).toFixed(2),
    justPaid: req.query.paid === '1'
  });
});

router.post('/corps', requireAuth, (req, res) => {
  const params = PalCalc.defaults();
  const name = (req.body.name || params.nume || 'Corp nou').toString().trim().slice(0, 80);
  params.nume = name;
  const info = db.prepare(
    'INSERT INTO corps (user_id, name, params, status) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, JSON.stringify(params), 'draft');
  res.redirect(`/corps/${info.lastInsertRowid}`);
});

router.get('/corps/:id', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);

  res.render('corps/edit', {
    title: corp.name,
    corp: rowToCorp(corp),
    priceLei: (Number(process.env.PRICE_PER_CORP_CENTS || 1500) / 100).toFixed(2),
    paymentDriver: process.env.PAYMENT_DRIVER || 'fake',
    justPaid: req.query.paid === '1'
  });
});

router.post('/corps/:id/duplicate', requireAuth, (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) return notFound(next);

  const params = parseParams(corp.params);
  const name = `${corp.name} (copie)`.slice(0, 80);
  params.nume = name;
  const info = db.prepare(
    'INSERT INTO corps (user_id, name, params, status) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, JSON.stringify(params), 'draft');
  res.redirect(`/corps/${info.lastInsertRowid}`);
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
  const safe = corp.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') || 'corp';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="debitare-${safe}.csv"`);
  res.send('﻿' + body); /* BOM, ca Excel sa deschida corect diacriticele */
});

module.exports = { router, getOwned, piecesFor, parseParams };
