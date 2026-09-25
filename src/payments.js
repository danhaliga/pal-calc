'use strict';
/* Plata per corp: driver 'fake' (dezvoltare) sau 'stripe' (Stripe Checkout).
   Trecerea intre ele se face doar din .env, fara modificari de cod. */

const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const { getOwned } = require('./corps');

const router = express.Router();

const driver = () => (process.env.PAYMENT_DRIVER || 'fake').toLowerCase();
const priceCents = () => Number(process.env.PRICE_PER_CORP_CENTS || 1500);
const currency = () => (process.env.CURRENCY || 'ron').toLowerCase();
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

let stripeClient = null;
function stripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY lipsește din .env.');
    stripeClient = require('stripe')(key);
  }
  return stripeClient;
}

/* ---- marcarea platii, idempotent ---- */

function markPaid(paymentId, corpId, userId) {
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE payments SET status = 'paid', updated_at = datetime('now') WHERE id = ? AND status <> 'paid'"
    ).run(paymentId);
    db.prepare(
      "UPDATE corps SET status = 'paid', paid_at = COALESCE(paid_at, datetime('now')), " +
      "updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).run(corpId, userId);
  });
  tx();
}

function createPaymentRow({ userId, corpId, provider, providerRef = null, status = 'pending' }) {
  const info = db.prepare(
    'INSERT INTO payments (user_id, corp_id, provider, provider_ref, amount_cents, currency, status) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, corpId, provider, providerRef, priceCents(), currency(), status);
  return Number(info.lastInsertRowid);
}

/* ---- pornirea platii ---- */

router.post('/corps/:id/pay', requireAuth, async (req, res, next) => {
  const corp = getOwned(req.params.id, req.user.id);
  if (!corp) {
    const err = new Error('Corpul nu există.');
    err.status = 404;
    return next(err);
  }
  if (corp.status === 'paid') return res.redirect(`/corps/${corp.id}`);

  try {
    if (driver() === 'fake') {
      const paymentId = createPaymentRow({
        userId: req.user.id, corpId: corp.id, provider: 'fake',
        providerRef: 'fake_' + Date.now(), status: 'paid'
      });
      markPaid(paymentId, corp.id, req.user.id);
      return res.redirect(`/corps/${corp.id}?paid=1`);
    }

    /* Stripe Checkout */
    const paymentId = createPaymentRow({
      userId: req.user.id, corpId: corp.id, provider: 'stripe'
    });

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: currency(),
          unit_amount: priceCents(),
          product_data: { name: `Listă de debitare – ${corp.name}` }
        }
      }],
      metadata: { corp_id: String(corp.id), user_id: String(req.user.id), payment_id: String(paymentId) },
      success_url: `${appUrl()}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/corps/${corp.id}`
    });

    db.prepare("UPDATE payments SET provider_ref = ?, updated_at = datetime('now') WHERE id = ?")
      .run(session.id, paymentId);

    res.redirect(303, session.url);
  } catch (e) { next(e); }
});

/* ---- intoarcerea de la Stripe (functioneaza si fara webhook) ---- */

router.get('/payments/success', requireAuth, async (req, res, next) => {
  const sessionId = req.query.session_id;

  if (driver() === 'fake' || !sessionId) return res.redirect('/corps');

  try {
    const session = await stripe().checkout.sessions.retrieve(String(sessionId));
    const corpId = Number(session.metadata && session.metadata.corp_id);
    const userId = Number(session.metadata && session.metadata.user_id);

    /* nu marcam nimic pe baza URL-ului: doar pe baza raspunsului Stripe */
    if (session.payment_status !== 'paid' || userId !== req.user.id) {
      return res.status(402).render('payments/cancel', {
        title: 'Plata nu a fost confirmată',
        message: 'Stripe nu a confirmat plata pentru acest corp.',
        corpId: corpId || null
      });
    }

    const row = db.prepare('SELECT * FROM payments WHERE provider_ref = ?').get(session.id);
    const paymentId = row ? row.id : createPaymentRow({
      userId, corpId, provider: 'stripe', providerRef: session.id, status: 'paid'
    });
    markPaid(paymentId, corpId, userId);

    res.render('payments/success', {
      title: 'Plată confirmată',
      corpId,
      amount: (session.amount_total / 100).toFixed(2),
      currency: (session.currency || currency()).toUpperCase()
    });
  } catch (e) { next(e); }
});

router.get('/payments/cancel', requireAuth, (req, res) => {
  res.render('payments/cancel', {
    title: 'Plată anulată',
    message: 'Plata a fost anulată. Corpul a rămas neschimbat.',
    corpId: req.query.corp_id ? Number(req.query.corp_id) : null
  });
});

/* ---- webhook Stripe (corp brut, semnatura verificata) ---- */

function webhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(400).send('STRIPE_WEBHOOK_SECRET lipsește.');

  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
  } catch (e) {
    return res.status(400).send(`Semnătură invalidă: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const corpId = Number(session.metadata && session.metadata.corp_id);
    const userId = Number(session.metadata && session.metadata.user_id);
    if (session.payment_status === 'paid' && corpId && userId) {
      const row = db.prepare('SELECT * FROM payments WHERE provider_ref = ?').get(session.id);
      const paymentId = row ? row.id : createPaymentRow({
        userId, corpId, provider: 'stripe', providerRef: session.id, status: 'paid'
      });
      markPaid(paymentId, corpId, userId);
    }
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler, driver, priceCents, currency };
