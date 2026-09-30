'use strict';
/* Inregistrare, autentificare, deconectare + middleware de protectie. */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db } = require('./db');
const jurnal = require('./jurnal');
const PalTari = require('../shared/tari');

const BCRYPT_COST = 12;

/* Mesajele de validare sunt chei: se traduc când se afișează, nu când
   se definește schema (schema se construiește o dată, la pornire). */
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('valid.emailNevalid').max(160),
  name: z.string().trim().max(80).optional().or(z.literal('')),
  password: z.string().min(8, 'valid.parolaScurta').max(200),
  password2: z.string(),
  /* Țara nu e obligatorie și nu dă eroare: ce nu e pe listă se curăță la
     gol. Un cont fără țară merge mai departe în milimetri și își alege
     unitatea mai târziu, din pagina contului. */
  tara: z.string().trim().toUpperCase().catch('')
}).refine(d => d.password === d.password2, {
  message: 'valid.paroleDiferite', path: ['password2']
});

/* La login acceptam si un nume de utilizator simplu (conturi create cu
   scripts/create-user.js), nu doar email. Cautarea se face oricum pe egalitate
   exacta, iar inregistrarea publica ramane restrictiva. */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(2, 'valid.emailLipsa').max(160),
  password: z.string().min(1, 'valid.parolaLipsa').max(200)
});

/* limita se poate ridica din .env pentru teste automate */
const LIMITA = Number(process.env.LOGIN_RATE_LIMIT || 10);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LIMITA,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'valid.preaMulteIncercari',
  handler: (req, res) => {
    /* răspunde pe pagina de unde a venit cererea, nu mereu pe cea de login */
    const peRegister = req.path === '/register';
    const values = { email: req.body && req.body.email ? String(req.body.email) : '',
                     name: '', tara: req.body ? req.body.tara : '' };
    /* Pagina de inregistrare are nevoie de lista de tari ca sa se randeze, si
       aici ajunge cineva care a incercat de prea multe ori. Se trece prin
       acelasi loc ca randarile normale: altfel limita de incercari s-ar
       intoarce cu o eroare de vedere in loc de mesajul ei. */
    if (peRegister) {
      return res.status(429).render('register',
        vedereaInregistrarii(req, values, req.t('valid.preaMulteIncercari')));
    }
    res.status(429).render('login', {
      title: req.t('auth.autentificare'),
      error: req.t('valid.preaMulteIncercari'),
      values: values
    });
  }
});

/* ---- ajutoare folosite si de scripturi ---- */

function createUser({ email, password, name = null, isAdmin = 0, tara = '' }) {
  const hash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, name, is_admin, tara) VALUES (?, ?, ?, ?, ?)'
  ).run(String(email).trim().toLowerCase(), hash, name || null, isAdmin ? 1 : 0,
        PalTari.normalizeaza(tara) || '');
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
}

/* ---- middleware ---- */

/* Ce se citeste despre om la fiecare cerere. Lista e scrisa pe bucati, nu
   `SELECT *`, dintr-un singur motiv: `password_hash` e in acelasi tabel, iar
   un `*` l-ar plimba prin `res.locals.user` pe fiecare pagina. Coloana
   adaugata din greseala la sfarsitul tabelului nu ajunge in vedere; parola,
   niciodata. */
const COLOANE_UTILIZATOR = [
  'id', 'email', 'name', 'is_admin', 'created_at', 'lang',
  'tara', 'unitate', 'firma', 'cui', 'telefon', 'oras', 'adresa', 'site', 'profil'
].join(', ');

function loadUser(req, res, next) {
  req.user = null;
  if (req.session && req.session.userId) {
    req.user = db.prepare(`SELECT ${COLOANE_UTILIZATOR} FROM users WHERE id = ?`)
                 .get(req.session.userId) || null;
    if (!req.user) req.session.userId = null;
  }
  res.locals.user = req.user;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nu ești autentificat.' });
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    const err = new Error('eroare.paginaLipsa');
    err.cheie = 'eroare.paginaLipsa';
    err.status = 404;
    return next(err);
  }
  next();
}

/* ---- rute ---- */

const router = express.Router();

/* Ce are nevoie formularul de înregistrare, o dată pentru amândouă locurile
   care-l randează: prima deschidere și întoarcerea cu o greșeală. */
function vedereaInregistrarii(req, values, error) {
  const ghicita = PalTari.dinAntet(req.headers['accept-language']);
  return {
    title: req.t('auth.contNou'),
    error: error || null,
    values: values,
    tari: PalTari.lista(req.lang),
    /* Ce e ales în selector: ce a trimis omul, altfel ce ghicim din browser.
       Ghicitul e o propunere pe care o vede și o poate schimba, nu o
       hotărâre luată în spatele lui. */
    taraAleasa: PalTari.normalizeaza(values.tara) || ghicita || ''
  };
}

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/orders');
  res.render('register', vedereaInregistrarii(req, {}));
});

router.post('/register', limiter, (req, res, next) => {
  if (req.user) return res.redirect('/orders');
  const parsed = registerSchema.safeParse(req.body);
  const values = { email: req.body.email || '', name: req.body.name || '',
                   tara: req.body.tara || '' };

  if (!parsed.success) {
    return res.status(400).render('register',
      vedereaInregistrarii(req, values, req.t(parsed.error.issues[0].message)));
  }
  if (findByEmail(parsed.data.email)) {
    return res.status(400).render('register',
      vedereaInregistrarii(req, values, req.t('valid.emailFolosit')));
  }

  try {
    const user = createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name || null,
      tara: parsed.data.tara
    });
    jurnal.fapta('cont', 'cont nou', { req, userId: user.id,
      detalii: { email: parsed.data.email, tara: user.tara || '(gol)' } });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      res.redirect('/orders');
    });
  } catch (e) { next(e); }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/orders');
  res.render('login', { title: req.t('auth.autentificare'), error: null, values: {} });
});

router.post('/login', limiter, (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  const values = { email: req.body.email || '' };

  if (!parsed.success) {
    return res.status(400).render('login', {
      title: req.t('auth.autentificare'), error: req.t(parsed.error.issues[0].message), values
    });
  }

  const user = findByEmail(parsed.data.email);
  const ok = user && bcrypt.compareSync(parsed.data.password, user.password_hash);
  if (!ok) {
    /* Se scrie CE adresa s-a incercat, nu si parola. O adresa incercata de
       zece ori la rand, din acelasi loc, se vede imediat in jurnal; parola
       n-ar spune nimic in plus si ar fi o pagubă daca jurnalul ajunge unde
       nu trebuie. */
    jurnal.atentie('cont', 'autentificare respinsa',
      { req, status: 401, detalii: { email: parsed.data.email, contExista: !!user } });
    return res.status(401).render('login', {
      title: req.t('auth.autentificare'), error: req.t('valid.dateGresite'), values
    });
  }
  jurnal.fapta('cont', 'a intrat in cont', { req, userId: user.id });

  const back = req.session.returnTo;
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.userId = user.id;
    res.redirect(back && back.startsWith('/') ? back : '/orders');
  });
});

/* ---- schimbarea parolei, din pagina contului ----

   Până aici nu exista: un cont rămânea cu parola de la înregistrare, iar
   cine o voia schimbată trebuia să ceară cuiva cu acces la server. Se cere
   parola de acum — o sesiune lăsată deschisă pe un calculator străin nu
   trebuie să ajungă să închidă omul pe dinafară. */
const parolaSchema = z.object({
  parolaVeche: z.string().min(1, 'valid.parolaLipsa').max(200),
  parolaNoua: z.string().min(8, 'valid.parolaScurta').max(200),
  parolaNoua2: z.string()
}).refine(d => d.parolaNoua === d.parolaNoua2, { message: 'valid.paroleDiferite' });

router.post('/cont/parola', limiter, requireAuth, (req, res) => {
  const parsed = parolaSchema.safeParse(req.body || {});
  const inapoi = cheie => res.redirect('/cont?parolaEroare=' + encodeURIComponent(cheie) + '#parola');
  if (!parsed.success) return inapoi(parsed.error.issues[0].message);

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(parsed.data.parolaVeche, user.password_hash)) {
    jurnal.atentie('cont', 'schimbare de parola respinsa', { req, status: 400 });
    return inapoi('cont.parolaVecheGresita');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(parsed.data.parolaNoua, BCRYPT_COST), user.id);
  jurnal.fapta('cont', 'si-a schimbat parola', { req });
  res.redirect('/cont?parola=1#parola');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = { router, loadUser, requireAuth, requireAdmin, createUser, findByEmail,
                   BCRYPT_COST, COLOANE_UTILIZATOR };
