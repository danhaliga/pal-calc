/* ============================================================
   Limba paginii.

   Se alege în ordinea asta, prima care dă un rezultat:
     1. ?lang=xx din adresă        — pentru linkuri și pentru testare
     2. limba salvată pe cont      — alegerea făcută de utilizator
     3. limba ținută în sesiune    — pentru vizitatorii fără cont
     4. antetul Accept-Language    — limba browserului
     5. româna

   Cataloagele se citesc o dată, la pornire. Ce lipsește dintr-o limbă
   cade pe română, așa că o traducere neterminată nu strică pagina.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const PalI18n = require('../shared/i18n');

const router = express.Router();
const DIR = path.join(__dirname, '..', 'locales');

/* ---------- încărcarea cataloagelor ---------- */

const lipsa = [];

function incarca() {
  for (const l of PalI18n.LIMBI) {
    const f = path.join(DIR, l.cod + '.json');
    if (!fs.existsSync(f)) { lipsa.push(l.cod); continue; }
    try {
      PalI18n.inregistreaza(l.cod, JSON.parse(fs.readFileSync(f, 'utf8')));
    } catch (e) {
      lipsa.push(l.cod);
      console.error(`traducerea ${l.cod} nu se poate citi: ${e.message}`);
    }
  }
  if (!PalI18n.catalog(PalI18n.IMPLICITA)) {
    throw new Error(`lipsește locales/${PalI18n.IMPLICITA}.json — fără el nu merge nimic`);
  }
}

/* Cât din română e acoperit de fiecare limbă. Folosit în panoul de administrare. */
function acoperire() {
  const ro = PalI18n.catalog(PalI18n.IMPLICITA) || {};
  const chei = aplatizeaza(ro);
  const total = chei.length;

  return PalI18n.LIMBI.map(l => {
    const c = PalI18n.catalog(l.cod);
    if (!c) return { cod: l.cod, nume: l.nume, traduse: 0, total, procent: 0 };
    const ale = new Set(aplatizeaza(c));
    const traduse = chei.filter(k => ale.has(k)).length;
    return { cod: l.cod, nume: l.nume, traduse, total,
             procent: total ? Math.round(traduse * 100 / total) : 0 };
  });
}

function aplatizeaza(obiect, prefix, afara) {
  const out = afara || [];
  for (const k of Object.keys(obiect || {})) {
    const v = obiect[k];
    const cheie = prefix ? prefix + '.' + k : k;
    /* un obiect cu forme de plural e o frunză, nu o ramură */
    if (v && typeof v === 'object' && !Array.isArray(v) && !estePlural(v)) {
      aplatizeaza(v, cheie, out);
    } else {
      out.push(cheie);
    }
  }
  return out;
}

const FORME = ['zero', 'one', 'two', 'few', 'many', 'other'];
function estePlural(v) {
  const k = Object.keys(v);
  return k.length > 0 && k.every(x => FORME.includes(x));
}

/* ---------- alegerea limbii ---------- */

function dinCerere(req) {
  const dinUrl = PalI18n.normalizeaza(req.query && req.query.lang);
  if (dinUrl) return dinUrl;

  const dinCont = req.user && PalI18n.normalizeaza(req.user.lang);
  if (dinCont) return dinCont;

  const dinSesiune = PalI18n.normalizeaza(req.session && req.session.lang);
  if (dinSesiune) return dinSesiune;

  return PalI18n.dinAntet(req.headers['accept-language']) || PalI18n.IMPLICITA;
}

function middleware(req, res, next) {
  const lang = dinCerere(req);
  const t = PalI18n.creeaza(lang);

  req.lang = lang;
  req.t = t;
  res.locals.t = t;
  res.locals.lang = lang;
  res.locals.dir = t.dir;
  res.locals.limbi = PalI18n.LIMBI;
  next();
}

/* ---------- schimbarea limbii ---------- */

router.post('/limba', (req, res) => {
  const lang = PalI18n.normalizeaza(req.body && req.body.lang) || PalI18n.IMPLICITA;

  if (req.session) req.session.lang = lang;

  if (req.user) {
    db.prepare('UPDATE users SET lang = ? WHERE id = ?').run(lang, req.user.id);
  }

  /* înapoi de unde a venit, dar numai pe o cale din aplicație */
  const inapoi = String(req.body.inapoi || '/');
  res.redirect(/^\/(?!\/)/.test(inapoi) ? inapoi : '/');
});

/* Pagina cu starea traducerilor, pentru administrator. */
router.get('/admin/limbi', requireAuth, (req, res, next) => {
  if (!req.user.is_admin) {
    const err = new Error('Pagina nu există.');
    err.status = 404;
    return next(err);
  }
  res.render('admin-limbi', {
    title: req.t('admin.limbi.titlu'),
    acoperire: acoperire(),
    lipsa
  });
});

module.exports = { router, middleware, incarca, acoperire, aplatizeaza, lipsa };
