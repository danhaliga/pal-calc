'use strict';
/* Panou de administrare: utilizatori, corpuri, plati, total incasat. */

const express = require('express');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const mesaje = require('./mesaje');
const jurnal = require('./jurnal');
const cont = require('./cont');
const PalTari = require('../shared/tari');

const router = express.Router();

router.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.is_admin, u.created_at, u.credit_cents,
           (SELECT COUNT(*) FROM corps c WHERE c.user_id = u.id) AS corps,
           (SELECT COUNT(*) FROM corps c WHERE c.user_id = u.id AND c.status = 'paid') AS paid,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS comenzi
    FROM users u ORDER BY u.created_at DESC, u.id DESC
  `).all();

  const corps = db.prepare(`
    SELECT c.id, c.name, c.status, c.created_at, c.updated_at, u.email
    FROM corps c JOIN users u ON u.id = c.user_id
    ORDER BY c.updated_at DESC, c.id DESC LIMIT 100
  `).all();

  const payments = db.prepare(`
    SELECT p.id, p.provider, p.provider_ref, p.amount_cents, p.currency, p.status,
           p.created_at, u.email, c.name AS corp_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN corps c ON c.id = p.corp_id
    ORDER BY p.created_at DESC, p.id DESC LIMIT 100
  `).all();

  const totals = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS n
    FROM payments WHERE status = 'paid'
  `).get();

  res.render('admin', {
    title: 'Administrare',
    users, corps, payments,
    /* Cine folosește aplicația și de unde. Numele țării se face în limba
       celui care se uită, nu în engleză. */
    tari: cont.dupaTara(30),
    profile: cont.dupaProfil(),
    numeTara: (cod) => PalTari.numeTara(cod, req.lang),
    unitatePentru: PalTari.unitatePentru,
    mesaje: mesaje.ultimele(100),
    mesajeNoi: mesaje.cateNoi(),
    totalLei: (totals.cents / 100).toFixed(2),
    totalCount: totals.n
  });
});

/* Jurnalul: ce s-a rupt si ce s-a intamplat, in ordine. Filtrele sunt
   putine inadins — un panou cu cincisprezece casute nu se foloseste. */
router.get('/admin/jurnal', requireAuth, requireAdmin, (req, res) => {
  const nivel = jurnal.NIVELE.indexOf(req.query.nivel) !== -1 ? req.query.nivel : null;
  const sursa = req.query.sursa || null;

  res.render('admin/jurnal', {
    title: req.t('jurnal.titlu'),
    randuri: jurnal.ultimele({ nivel, sursa, limita: 300 }),
    numere: jurnal.numaratoare(),
    surse: jurnal.surse(),
    nivele: jurnal.NIVELE,
    nivelAles: nivel,
    sursaAleasa: sursa,
    zile: jurnal.ZILE,
    maxim: jurnal.MAXIM
  });
});

module.exports = { router };
