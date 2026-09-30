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
const materiale = require('./src/materiale');
const credit = require('./src/credit');
const payments = require('./src/payments');
const admin = require('./src/admin');
const mesaje = require('./src/mesaje');
const cont = require('./src/cont');
const jurnal = require('./src/jurnal');
const articole = require('./src/articole');
const legal = require('./src/legal');
const prestatori = require('./src/prestatori');
const i18n = require('./src/i18n');
const PalI18n = require('./shared/i18n');

migrate();
i18n.incarca();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

/* `upgrade-insecure-requests` urcă orice cerere pe https. În producție e
   exact ce vrem; pe un server local de http rupe redirecţiile — POST-ul
   trece, iar redirecţia de după el cade cu ERR_SSL_PROTOCOL_ERROR și pare
   că butonul „nu face nimic". Îl legăm de aceeași condiție ca la cookie. */
const PE_HTTPS = (process.env.APP_URL || '').startsWith('https://');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      upgradeInsecureRequests: PE_HTTPS ? [] : null,
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

/* Firma, pentru subsolul fiecărei pagini (obligatoriu la vânzarea online).
   Pusă înaintea verificărilor, ca s-o aibă și paginile de eroare. */
app.use((req, res, next) => { res.locals.firma = legal.FIRMA; next(); });

app.use(auth.loadUser);
app.use(i18n.middleware);
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
  res.locals.jsonPentruPagina = require('./src/util').jsonPentruPagina;
  res.locals.catalogPagina = (...spatii) =>
    require('./src/util').catalogPagina(req.lang, spatii);
  res.locals.appName = 'PAL Calc';
  /* „fake" doar când chiar merge: pe un site public driverul fals nu pune
     credit (vezi payments.stare), deci bara „plată de test" ar minți. */
  const plata = payments.stare();
  res.locals.paymentDriver = plata.pornita ? plata.driver : 'oprita';
  res.locals.priceLei = (payments.priceCents() / 100).toFixed(2);
  /* Pe paginile de prezentare prețul se scrie în euro, cum l-a vrut Dan
     („1 €"); în aplicație și la plată rămâne în lei. */
  res.locals.pretPublic = require('./src/setari').citeste('PRET_PUBLIC') || '1 €';
  res.locals.currentPath = req.path;
  res.locals.soldLei = req.user ? (credit.sold(req.user.id) / 100).toFixed(2) : null;
  /* Cine e atelierul, pentru capul foilor de tipar. Null cât timp omul nu a
     completat nimic în cont — atunci foaia rămâne cum era, fără un cap gol
     care mănâncă hârtie. */
  res.locals.capFoaie = req.user ? cont.capDeFoaie(req.user) : null;
  next();
});

/* Serviciul pe care stă aplicația întreabă din când în când dacă mai e vie.
   Nu întoarce doar „da": atinge și baza de date, fiindcă o aplicație care
   răspunde dar nu-și găsește baza e la fel de nefolositoare ca una căzută. */
app.get('/sanatate', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, baza: 'raspunde' });
  } catch (e) {
    res.status(503).json({ ok: false, baza: 'nu raspunde' });
  }
});

app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/shared', express.static(path.join(__dirname, 'shared'), { maxAge: '1h' }));

app.get('/', (req, res) => {
  if (req.user) return res.redirect('/orders');

  /* Exemplul de pe pagina de prezentare se calculeaza ACUM, cu acelasi motor
     care scoate lucrarile din atelier. Nu e un tabel scris de mana: daca se
     schimba regula de debitare, se schimba si cifrele de aici. Si vine gata
     tradus, fiindca numele pieselor sunt chei din catalog. */
  const PalModels = require('./shared/models');
  const PalCalc = require('./shared/calc');
  const exemplu = PalModels.paramsFor('baza-2usi', req.t);
  const calculat = PalCalc.calc(exemplu, req.t);

  res.render('landing', {
    title: req.t('landing.titlu'),
    exemplu: exemplu,
    piese: calculat.P,
    limbi: PalI18n.LIMBI,
    film: require('./src/film').date(req.t)
  });
});

/* „Cum funcționează": pagina, apoi pașii ca JSON (calculați o dată pe
   limbă și ținuți în memorie: nu depind de nimic din baza de date). */
app.get('/cum-functioneaza', (req, res) => {
  res.render('tutorial', { title: req.t('tutorial.titluPagina') });
});
const tutorialPeLimba = {};
app.get('/cum-functioneaza/date.json', (req, res) => {
  const cheie = req.lang || 'ro';
  if (!tutorialPeLimba[cheie]) tutorialPeLimba[cheie] = JSON.stringify(require('./src/tutorial').date(req.t));
  res.type('application/json').set('Cache-Control', 'public, max-age=3600').send(tutorialPeLimba[cheie]);
});

/* Pagina publică a planificatorului 3D, cu o bucătărie de exemplu pe care
   vizitatorul o poate rearanja fără cont (nimic nu se salvează). */
app.get('/planificator', (req, res) => {
  res.render('planificator', {
    title: req.t('planificator.titlu'),
    demo: require('./src/demo3d').date(req.t),
    pereti: require('./shared/ansamblu').pereti(req.t)
  });
});

app.use(i18n.router);
app.use(auth.router);
app.use(credit.router);
app.use(materiale.router);
app.use(orders.router);
app.use(corps.router);
app.use(payments.router);
app.use(admin.router);
app.use(mesaje.router);
app.use(cont.router);
app.use(articole.router);
app.use(legal.router);
app.use(prestatori.router);

/* ---- erori ---- */

app.use((req, res, next) => {
  next(require('./src/util').eroare('eroare.paginaLipsa', 404));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error(err);

  /* Erorile intra si in jurnal, nu doar in consola: consola de pe server se
     deruleaza si se pierde, iar cand te uiti tu randul cu pricina a plecat
     de mult. Cele sub 500 sunt cereri gresite, nu defectiuni ale noastre —
     le tinem ca „atentie", ca sa se vada un tipar daca cineva bajbaie. */
  jurnal.scrie(status >= 500 ? 'eroare' : 'atentie', 'http',
    status >= 500 ? (err.message || 'eroare de server') : (err.cheie || 'cerere respinsa'),
    { req, status, detalii: status >= 500 ? err : { cheie: err.cheie } });

  /* traducem doar erorile noastre; restul nu ajung niciodată la utilizator */
  const t = req.t || require('./shared/i18n').creeaza(null);
  const text = status >= 500 ? t('eroare.server')
             : err.cheie ? t(err.cheie)
             : t('eroare.cerere');

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: text });
  }
  res.status(status).render('error', {
    title: status === 404 ? t('eroare.titlu404') : t('eroare.titlu'),
    status,
    message: text
  });
});

if (require.main === module) {
  /* Verificările de configurare se fac ÎNAINTE de a deschide portul. Pe o
     adresă publică, o pornire liniștită cu secretul de dezvoltare e mai rea
     decât o eroare: nu se vede nicăieri. Vezi src/pornire.js. */
  const pornire = require('./src/pornire');
  const admini = db.prepare('SELECT email, password_hash FROM users WHERE is_admin = 1').all();
  /* Cu setările din Administrare → Plata puse peste .env: acolo stau acum
     cheile Stripe. */
  const mediu = require('./src/setari').mediu(process.env);
  if (!pornire.aplica(pornire.verifica(mediu, admini))) process.exit(1);

  app.listen(PORT, () => {
    console.log(`PAL Calc pornit pe http://localhost:${PORT}  (plată: ${payments.driver()})`);
  });
}

module.exports = app;
