'use strict';
/* Bootstrap Express: sesiuni, securitate, rute, pornire server. */

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);

const { db, migrate } = require('./src/db');
const auth = require('./src/auth');
const csrf = require('./src/csrf');
const corps = require('./src/corps');
const orders = require('./src/orders');
const credit = require('./src/credit');
const payments = require('./src/payments');
const admin = require('./src/admin');

migrate();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'", 'https://checkout.stripe.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

/* Webhook-ul Stripe are nevoie de corpul brut, inainte de parserul JSON. */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), payments.webhookHandler);

app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(express.json({ limit: '256kb' }));

app.use(session({
  store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
  secret: process.env.SESSION_SECRET || 'dev-secret-schimba-ma',
  resave: false,
  saveUninitialized: false,
  name: 'palcalc.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.APP_URL || '').startsWith('https://'),
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

app.use(auth.loadUser);
app.use(csrf.middleware);

/* Layout: fiecare view se randeaza in views/layout.ejs, in variabila `body`. */
app.use((req, res, next) => {
  const render = res.render.bind(res);
  res.render = function (view, opts, cb) {
    opts = opts || {};
    if (cb) return render(view, opts, cb);
    render(view, opts, (err, html) => {
      if (err) return next(err);
      const layout = opts.print ? 'layout-print' : 'layout';
      render(layout, Object.assign({}, opts, { body: html }), (err2, page) => {
        if (err2) return next(err2);
        res.send(page);
      });
    });
  };
  next();
});

/* Amprenta fisierelor statice: se schimba la fiecare pornire, ca browserul sa nu
   ramana cu un CSS sau un script vechi din cache dupa o actualizare. */
const ASSET_V = Date.now().toString(36);

app.use((req, res, next) => {
  res.locals.assetV = ASSET_V;
  res.locals.appName = 'PAL Calc';
  res.locals.paymentDriver = payments.driver();
  res.locals.priceLei = (payments.priceCents() / 100).toFixed(2);
  res.locals.currentPath = req.path;
  res.locals.soldLei = req.user ? (credit.sold(req.user.id) / 100).toFixed(2) : null;
  next();
});

app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/shared', express.static(path.join(__dirname, 'shared'), { maxAge: '1h' }));

app.get('/', (req, res) => {
  if (req.user) return res.redirect('/orders');
  res.render('landing', { title: 'Calculator debitare PAL' });
});

app.use(auth.router);
app.use(credit.router);
app.use(orders.router);
app.use(corps.router);
app.use(payments.router);
app.use(admin.router);

/* ---- erori ---- */

app.use((req, res, next) => {
  const err = new Error('Pagina nu există.');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error(err);

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: err.message || 'Eroare internă.' });
  }
  res.status(status).render('error', {
    title: status === 404 ? 'Pagina nu există' : 'Eroare',
    status,
    message: status >= 500 ? 'A apărut o eroare pe server.' : err.message
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PAL Calc pornit pe http://localhost:${PORT}  (plată: ${payments.driver()})`);
  });
}

module.exports = app;
