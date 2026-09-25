'use strict';
/* Inregistrare, autentificare, deconectare + middleware de protectie. */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { db } = require('./db');

const BCRYPT_COST = 12;

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresa de email nu este validă.').max(160),
  name: z.string().trim().max(80).optional().or(z.literal('')),
  password: z.string().min(8, 'Parola trebuie să aibă cel puțin 8 caractere.').max(200),
  password2: z.string()
}).refine(d => d.password === d.password2, {
  message: 'Parolele nu coincid.', path: ['password2']
});

/* La login acceptam si un nume de utilizator simplu (conturi create cu
   scripts/create-user.js), nu doar email. Cautarea se face oricum pe egalitate
   exacta, iar inregistrarea publica ramane restrictiva. */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(2, 'Introdu emailul sau numele de utilizator.').max(160),
  password: z.string().min(1, 'Introdu parola.').max(200)
});

/* limita se poate ridica din .env pentru teste automate */
const LIMITA = Number(process.env.LOGIN_RATE_LIMIT || 10);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LIMITA,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Prea multe încercări. Încearcă din nou peste 15 minute.',
  handler: (req, res) => {
    /* răspunde pe pagina de unde a venit cererea, nu mereu pe cea de login */
    const peRegister = req.path === '/register';
    res.status(429).render(peRegister ? 'register' : 'login', {
      title: peRegister ? 'Cont nou' : 'Autentificare',
      error: 'Prea multe încercări de pe această adresă. Încearcă din nou peste 15 minute.',
      values: { email: req.body && req.body.email ? String(req.body.email) : '' }
    });
  }
});

/* ---- ajutoare folosite si de scripturi ---- */

function createUser({ email, password, name = null, isAdmin = 0 }) {
  const hash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, name, is_admin) VALUES (?, ?, ?, ?)'
  ).run(String(email).trim().toLowerCase(), hash, name || null, isAdmin ? 1 : 0);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
}

/* ---- middleware ---- */

function loadUser(req, res, next) {
  req.user = null;
  if (req.session && req.session.userId) {
    req.user = db.prepare('SELECT id, email, name, is_admin FROM users WHERE id = ?')
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
    const err = new Error('Pagina nu există.');
    err.status = 404;
    return next(err);
  }
  next();
}

/* ---- rute ---- */

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/orders');
  res.render('register', { title: 'Cont nou', error: null, values: {} });
});

router.post('/register', limiter, (req, res, next) => {
  if (req.user) return res.redirect('/orders');
  const parsed = registerSchema.safeParse(req.body);
  const values = { email: req.body.email || '', name: req.body.name || '' };

  if (!parsed.success) {
    return res.status(400).render('register', {
      title: 'Cont nou', error: parsed.error.issues[0].message, values
    });
  }
  if (findByEmail(parsed.data.email)) {
    return res.status(400).render('register', {
      title: 'Cont nou', error: 'Există deja un cont cu acest email.', values
    });
  }

  try {
    const user = createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name || null
    });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.userId = user.id;
      res.redirect('/orders');
    });
  } catch (e) { next(e); }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/orders');
  res.render('login', { title: 'Autentificare', error: null, values: {} });
});

router.post('/login', limiter, (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  const values = { email: req.body.email || '' };

  if (!parsed.success) {
    return res.status(400).render('login', {
      title: 'Autentificare', error: parsed.error.issues[0].message, values
    });
  }

  const user = findByEmail(parsed.data.email);
  const ok = user && bcrypt.compareSync(parsed.data.password, user.password_hash);
  if (!ok) {
    return res.status(401).render('login', {
      title: 'Autentificare', error: 'Email sau parolă greșite.', values
    });
  }

  const back = req.session.returnTo;
  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.userId = user.id;
    res.redirect(back && back.startsWith('/') ? back : '/orders');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = { router, loadUser, requireAuth, requireAdmin, createUser, findByEmail, BCRYPT_COST };
