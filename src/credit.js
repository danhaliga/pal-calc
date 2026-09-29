'use strict';
/* Creditul din cont: alimentare (prin driverul de plată) și consum la fiecare corp. */

const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const plati = require('./payments');

const router = express.Router();

const pretCorp = () => Number(process.env.PRICE_PER_CORP_CENTS || 500);
const lei = c => (c / 100).toFixed(2);

/* sume propuse la alimentare, în bani */
const PACHETE = [5000, 10000, 20000, 50000];

/* ---------- operații pe sold ---------- */

function sold(userId) {
  const u = db.prepare('SELECT credit_cents FROM users WHERE id = ?').get(userId);
  return u ? u.credit_cents : 0;
}

const aplica = db.transaction((userId, delta, kind, ref, note) => {
  const u = db.prepare('SELECT credit_cents FROM users WHERE id = ?').get(userId);
  if (!u) return null;
  const dupa = u.credit_cents + delta;
  if (dupa < 0) return null;                       /* fonduri insuficiente */
  db.prepare('UPDATE users SET credit_cents = ? WHERE id = ?').run(dupa, userId);
  db.prepare(
    'INSERT INTO credit_tx (user_id, delta_cents, balance_after, kind, ref, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, delta, dupa, kind, ref == null ? null : String(ref), note || null);
  return dupa;
});

function adauga(userId, cents, kind, ref, note) {
  if (!(cents > 0)) return null;
  const sold = aplica(userId, cents, kind || 'topup', ref, note);
  /* Creditul sunt bani. Fiecare adaugare se vede in jurnal, cu cat si de
     unde — daca se alimenteaza singur cineva, se vede. */
  require('./jurnal').fapta('credit', 'credit adaugat', {
    userId: userId,
    detalii: { suma: (cents / 100).toFixed(2), fel: kind || 'topup', ref: ref, nota: note, soldNou: sold }
  });
  return sold;
}

/* Scade costul unui corp. Întoarce null dacă nu ajunge creditul. */
function scade(userId, cents, kind, ref, note) {
  if (!(cents > 0)) return sold(userId);
  return aplica(userId, -cents, kind || 'corp', ref, note);
}

function istoric(userId, limit = 50) {
  return db.prepare(
    'SELECT * FROM credit_tx WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?'
  ).all(userId, limit);
}

/* ---------- pagini ---------- */

router.get('/credit', requireAuth, (req, res) => {
  res.render('credit', {
    title: req.t('credit.titlu'),
    sold: sold(req.user.id),
    pachete: PACHETE,
    pretCorp: pretCorp(),
    istoric: istoric(req.user.id),
    alimentat: req.query.ok === '1',
    plataPornita: plati.stare().pornita,
    insuficient: req.query.insuficient === '1'
  });
});

router.post('/credit/topup', requireAuth, async (req, res, next) => {
  const cents = Number(req.body.amount_cents);
  if (!PACHETE.includes(cents)) {
    const err = require('./util').eroare('eroare.sumaInvalida', 400);
    err.status = 400;
    return next(err);
  }

  /* Plata nepusă pe un site public: nu se alimentează nimic, nici gratis. */
  const stare = plati.stare();
  if (!stare.pornita) {
    require('./jurnal').scrie('atentie', 'plata', 'alimentare cerută cu plata nepornită',
      { req, detalii: { driver: stare.driver } });
    return res.redirect('/credit');
  }

  try {
    if (stare.driver === 'fake') {
      const plataId = plati.creeazaPlata({
        userId: req.user.id, kind: 'topup', provider: 'fake',
        providerRef: 'fake_topup_' + Date.now(), amountCents: cents, status: 'paid'
      });
      adauga(req.user.id, cents, 'topup', plataId, 'alimentare de test');
      return res.redirect('/credit?ok=1');
    }

    const url = await plati.checkoutTopup({
      user: req.user, cents,
      descriere: 'Credit PAL Calc – ' + lei(cents) + ' RON'
    });
    res.redirect(303, url);
  } catch (e) { next(e); }
});

module.exports = { router, sold, adauga, scade, istoric, pretCorp, PACHETE };
