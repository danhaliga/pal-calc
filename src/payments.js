'use strict';
/* Plăți: alimentarea creditului prin Stripe Checkout sau prin driverul 'fake'.
   Trecerea între ele se face doar din .env, fără modificări de cod. */

const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

const driver = () => (process.env.PAYMENT_DRIVER || 'fake').toLowerCase();
const priceCents = () => Number(process.env.PRICE_PER_CORP_CENTS || 500);
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

/* ---------- rânduri în payments ---------- */

function creeazaPlata({ userId, corpId = null, kind = 'corp', provider, providerRef = null,
                        amountCents, status = 'pending' }) {
  const info = db.prepare(
    'INSERT INTO payments (user_id, corp_id, kind, provider, provider_ref, amount_cents, currency, status) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, corpId, kind, provider, providerRef, amountCents, currency(), status);
  return Number(info.lastInsertRowid);
}

function plataDupaRef(ref) {
  return db.prepare('SELECT * FROM payments WHERE provider_ref = ?').get(ref);
}

/* Creditează o singură dată, indiferent câte căi confirmă plata
   (întoarcerea din Checkout și webhook-ul pot sosi amândouă). */
const confirmaTopup = db.transaction((plataId, userId, cents) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(plataId);
  if (!p || p.status === 'paid') return false;
  db.prepare("UPDATE payments SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(plataId);
  const credit = require('./credit');
  credit.adauga(userId, cents, 'topup', plataId, 'alimentare card');
  return true;
});

/* ---------- Stripe Checkout pentru alimentare ---------- */

async function checkoutTopup({ user, cents, descriere }) {
  const plataId = creeazaPlata({
    userId: user.id, kind: 'topup', provider: 'stripe', amountCents: cents
  });

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency(),
        unit_amount: cents,
        product_data: { name: descriere }
      }
    }],
    metadata: { kind: 'topup', user_id: String(user.id), payment_id: String(plataId), cents: String(cents) },
    success_url: `${appUrl()}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/credit`
  });

  db.prepare("UPDATE payments SET provider_ref = ?, updated_at = datetime('now') WHERE id = ?")
    .run(session.id, plataId);

  return session.url;
}

/* ---------- întoarcerea de la Stripe (funcționează și fără webhook) ---------- */

router.get('/payments/success', requireAuth, async (req, res, next) => {
  const sessionId = req.query.session_id;
  if (driver() === 'fake' || !sessionId) return res.redirect('/credit');

  try {
    const session = await stripe().checkout.sessions.retrieve(String(sessionId));
    const meta = session.metadata || {};
    const userId = Number(meta.user_id);

    /* nimic nu se creditează pe baza URL-ului: doar pe baza răspunsului Stripe */
    if (session.payment_status !== 'paid' || userId !== req.user.id) {
      return res.status(402).render('payments/cancel', {
        title: 'Plata nu a fost confirmată',
        message: 'Stripe nu a confirmat această plată.',
        corpId: null
      });
    }

    const rand = plataDupaRef(session.id);
    const plataId = rand ? rand.id : creeazaPlata({
      userId, kind: 'topup', provider: 'stripe', providerRef: session.id,
      amountCents: session.amount_total, status: 'pending'
    });
    confirmaTopup(plataId, userId, Number(meta.cents || session.amount_total));

    res.render('payments/success', {
      title: 'Plată confirmată',
      corpId: null,
      amount: (session.amount_total / 100).toFixed(2),
      currency: (session.currency || currency()).toUpperCase()
    });
  } catch (e) { next(e); }
});

router.get('/payments/cancel', requireAuth, (req, res) => {
  res.render('payments/cancel', {
    title: 'Plată anulată',
    message: 'Plata a fost anulată. Creditul a rămas neschimbat.',
    corpId: null
  });
});

/* ---------- webhook (corp brut, semnătură verificată) ---------- */

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
    const meta = session.metadata || {};
    const userId = Number(meta.user_id);
    if (session.payment_status === 'paid' && userId) {
      const rand = plataDupaRef(session.id);
      const plataId = rand ? rand.id : creeazaPlata({
        userId, kind: 'topup', provider: 'stripe', providerRef: session.id,
        amountCents: session.amount_total, status: 'pending'
      });
      confirmaTopup(plataId, userId, Number(meta.cents || session.amount_total));
    }
  }

  res.json({ received: true });
}

module.exports = {
  router, webhookHandler, driver, priceCents, currency,
  creeazaPlata, checkoutTopup, plataDupaRef
};
