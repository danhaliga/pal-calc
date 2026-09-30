'use strict';
/* Plăți: alimentarea creditului prin Stripe Checkout sau prin driverul 'fake'.
   Driverul și cheile se pun din Administrare → Plata (src/setari.js); .env
   rămâne rezervă. */

const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const setari = require('./setari');
const { estePublic } = require('./pornire');

const router = express.Router();

const driver = () => (setari.citeste('PAYMENT_DRIVER') || 'fake').toLowerCase();
const priceCents = () => Number(process.env.PRICE_PER_CORP_CENTS || 500);
const currency = () => (process.env.CURRENCY || 'ron').toLowerCase();
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

/* Clientul se face din nou când se schimbă cheia din panou; altfel ar
   merge cu cea veche până la repornire. */
let stripeClient = null;
let stripeCheie = null;
function clientPentru(key) {
  return require('stripe')(key, { timeout: 20000, maxNetworkRetries: 1 });
}
function stripe() {
  const key = setari.citeste('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY lipsește: se pune din Administrare → Plata.');
  if (!stripeClient || stripeCheie !== key) {
    stripeClient = clientPentru(key);
    stripeCheie = key;
  }
  return stripeClient;
}

/* Poate cineva să-și alimenteze creditul chiar acum?

   Driverul „fake" pune credit virtual, fără card. Pe un site public
   înseamnă credit gratis pentru oricine — și e lăsat așa ÎNADINS cât
   timp aplicația se probează: e alegerea administratorului, făcută în
   Administrare → Plata, unde se și vede cu roșu.

   Stripe e pornit doar cu amândouă cheile. Cu una lipsă, alimentarea stă
   oprită, nu cade pe credit gratis: cine a ales Stripe a ales bani
   adevărați. */
function stare() {
  const d = driver();
  const publ = estePublic(process.env);
  const cheie = setari.citeste('STRIPE_SECRET_KEY');
  const webhook = setari.citeste('STRIPE_WEBHOOK_SECRET');
  let pornita = false;
  if (d === 'stripe') pornita = !!(cheie && webhook);
  else if (d === 'fake') pornita = true;
  return {
    driver: d,
    public: publ,
    pornita: pornita,
    areCheie: !!cheie,
    areWebhook: !!webhook,
    mod: /^[a-z]+_live_/.test(cheie) ? 'live' : /^[a-z]+_test_/.test(cheie) ? 'test' : ''
  };
}

/* ---------- pentru pagina de administrare ---------- */

const FORMAT_CHEIE = /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/;
const FORMAT_WEBHOOK = /^whsec_[A-Za-z0-9+/=]{10,}$/;
const EVENIMENTE = ['checkout.session.completed'];

/* Întreabă Stripe dacă cheia merge, înainte s-o salvăm. O cheie greșită
   salvată s-ar vedea abia la prima plată a unui client. Se cere lista de
   plăți Checkout fiindcă exact de dreptul ăsta are nevoie aplicația — merge
   și pentru o cheie restrânsă (rk_) care are doar ce-i trebuie. */
async function verificaCheie(key) {
  const s = clientPentru(key);
  await s.checkout.sessions.list({ limit: 1 });
  let cont = '';
  try {
    const a = await s.accounts.retrieve();
    cont = (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) ||
           (a.business_profile && a.business_profile.name) || a.email || '';
  } catch (e) { /* o cheie restrânsă poate să nu vadă contul: nu e o greșeală */ }
  return { cont: cont };
}

/* Face în Stripe adresa la care vin confirmările de plată și întoarce
   secretul ei — ca omul să nu trebuiască să-l caute prin panoul Stripe.

   Stripe arată secretul O SINGURĂ DATĂ, la facere. Dacă există deja o
   adresă spre același URL (de la o încercare de dinainte), secretul ei nu
   se mai poate afla: o ștergem și o facem din nou. E a noastră — e chiar
   adresa site-ului — deci nu atingem nimic străin. */
async function facWebhook(key, url) {
  const s = clientPentru(key);
  const lista = await s.webhookEndpoints.list({ limit: 100 });
  for (const w of lista.data) {
    if (w.url === url) await s.webhookEndpoints.del(w.id);
  }
  const w = await s.webhookEndpoints.create({
    url: url,
    enabled_events: EVENIMENTE,
    description: 'PAL Calc: confirmarea alimentărilor de credit'
  });
  return w.secret;
}

const webhookUrl = () => appUrl() + '/webhooks/stripe';

/* ---------- rânduri în payments ---------- */

/* `facturare`: datele de facturare din clipa plății (vezi src/facturare.js),
   copiate pe plată ca factura să iasă cu ele. */
function creeazaPlata({ userId, corpId = null, kind = 'corp', provider, providerRef = null,
                        amountCents, status = 'pending', facturare = null }) {
  const info = db.prepare(
    'INSERT INTO payments (user_id, corp_id, kind, provider, provider_ref, amount_cents, currency, status, facturare) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, corpId, kind, provider, providerRef, amountCents, currency(), status,
        facturare ? JSON.stringify(facturare) : null);
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
    userId: user.id, kind: 'topup', provider: 'stripe', amountCents: cents,
    facturare: require('./facturare').dinCont(user)
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
        title: req.t('plata.neconfirmataTitlu'),
        message: req.t('plata.neconfirmataText'),
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
      title: req.t('plata.confirmata'),
      corpId: null,
      amount: (session.amount_total / 100).toFixed(2),
      currency: (session.currency || currency()).toUpperCase()
    });
  } catch (e) { next(e); }
});

router.get('/payments/cancel', requireAuth, (req, res) => {
  res.render('payments/cancel', {
    title: req.t('plata.anulataTitlu'),
    message: req.t('plata.anulataText'),
    corpId: null
  });
});

/* ---------- webhook (corp brut, semnătură verificată) ---------- */

function webhookHandler(req, res) {
  const secret = setari.citeste('STRIPE_WEBHOOK_SECRET');
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
  router, webhookHandler, driver, priceCents, currency, appUrl, stare,
  creeazaPlata, checkoutTopup, plataDupaRef,
  verificaCheie, facWebhook, webhookUrl, FORMAT_CHEIE, FORMAT_WEBHOOK
};
