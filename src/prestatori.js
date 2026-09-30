'use strict';
/* Prestatorii de servicii și trimiterea comenzii la ei.
   ============================================================

   Atelierul face proiectul în aplicație, apoi îl trimite la un prestator
   (debitare, cant, CNC) pe email: arhiva proiectului atașată, cu titlul și
   textul mailului scrise de el. Lista prestatorilor o ține administratorul;
   atelierul doar alege din ea — aplicația nu trimite la orice adresă.

   Administrare → Email: serverul de email și mesajul implicit.
   Administrare → Prestatori: lista.
   ============================================================ */

const express = require('express');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const setari = require('./setari');
const email = require('./email');
const jurnal = require('./jurnal');

const router = express.Router();

/* Câte trimiteri pe zi are voie un cont: destul pentru orice atelier,
   prea puțin ca să se facă din aplicație o mașină de spam. */
const PE_ZI = 20;

const LUNGIMI = { nume: 120, oras: 80, email: 200, telefon: 40, servicii: 200, nota: 1000 };
const text = (v, k) => String(v == null ? '' : v).trim().slice(0, LUNGIMI[k] || 200);

/* ---------- prestatorii ---------- */

function activi() {
  return db.prepare('SELECT * FROM prestatori WHERE activ = 1 ORDER BY nume COLLATE NOCASE, id').all();
}

function toti() {
  return db.prepare('SELECT * FROM prestatori ORDER BY activ DESC, nume COLLATE NOCASE, id').all();
}

function unul(id) {
  return db.prepare('SELECT * FROM prestatori WHERE id = ?').get(Number(id) || 0);
}

/* Întoarce lista de erori; goală = salvat. */
function salveaza(id, body) {
  const d = {
    nume: text(body.nume, 'nume'), oras: text(body.oras, 'oras'), email: text(body.email, 'email'),
    telefon: text(body.telefon, 'telefon'), servicii: text(body.servicii, 'servicii'), nota: text(body.nota, 'nota'),
    activ: body.activ === '0' ? 0 : 1
  };
  const erori = [];
  if (!d.nume) erori.push('prestator.eroareNume');
  /* mai multe adrese, cu virgulă: biroul și omul de la debitare */
  const adrese = d.email.split(/[,;\s]+/).filter(Boolean);
  if (!adrese.length || !adrese.every(email.emailBun)) erori.push('prestator.eroareEmail');
  if (erori.length) return erori;
  d.email = adrese.join(', ');
  if (id) {
    db.prepare('UPDATE prestatori SET nume = @nume, oras = @oras, email = @email, telefon = @telefon, ' +
               'servicii = @servicii, nota = @nota, activ = @activ WHERE id = @id').run(Object.assign({ id }, d));
  } else {
    db.prepare('INSERT INTO prestatori (nume, oras, email, telefon, servicii, nota, activ) ' +
               'VALUES (@nume, @oras, @email, @telefon, @servicii, @nota, @activ)').run(d);
  }
  return [];
}

/* ---------- mesajul ---------- */

/* Atelierul, cum semnează: firma, altfel numele, altfel adresa de email. */
function atelier(u) {
  return (u && (u.firma || u.name || u.email)) || '';
}

/* {comanda}, {atelier}... înlocuite; ce nu e cunoscut rămâne cum e. */
function completeaza(sablon, date) {
  return String(sablon || '').replace(/\{(\w+)\}/g, (m, k) => (date[k] != null ? String(date[k]) : m));
}

function sabloane(t) {
  return {
    subiect: setari.citeste('EMAIL_SUBIECT') || t('prestator.subiectImplicit'),
    text: setari.citeste('EMAIL_TEXT') || t('prestator.textImplicit')
  };
}

/* Titlul și textul propuse pe pagina comenzii. */
function propunere(order, user, prestator, t) {
  const s = sabloane(t);
  const date = {
    comanda: order.name, atelier: atelier(user), telefon: user.telefon || '', email: user.email || '',
    prestator: prestator ? prestator.nume : '', livrare: order.livrare_la || ''
  };
  return { subiect: completeaza(s.subiect, date).trim(), text: completeaza(s.text, date).trim() };
}

/* ---------- trimiterile ---------- */

function aleComenzii(orderId) {
  return db.prepare('SELECT * FROM trimiteri WHERE order_id = ? ORDER BY created_at DESC, id DESC').all(orderId);
}

function azi(userId) {
  return db.prepare("SELECT COUNT(*) AS n FROM trimiteri WHERE user_id = ? AND created_at >= datetime('now', '-1 day')")
    .get(userId).n;
}

function noteaza(r) {
  db.prepare('INSERT INTO trimiteri (order_id, user_id, prestator_id, prestator, catre, subiect, stare, eroare) ' +
             'VALUES (@order_id, @user_id, @prestator_id, @prestator, @catre, @subiect, @stare, @eroare)').run(r);
}

/* ---------- Administrare → Email ---------- */

router.get('/admin/email', requireAuth, requireAdmin, (req, res) => {
  const flash = req.session.emailFlash || {};
  delete req.session.emailFlash;
  const c = email.config();
  res.render('admin/email', {
    title: req.t('prestator.emailTitlu'),
    c, parolaMasca: c.parola ? '••••••••' : '',
    pornit: email.pornit(), proba: email.eProba(),
    sab: {
      subiect: setari.citeste('EMAIL_SUBIECT'), text: setari.citeste('EMAIL_TEXT'),
      subiectImplicit: req.t('prestator.subiectImplicit'), textImplicit: req.t('prestator.textImplicit')
    },
    ok: flash.ok || [], erori: flash.erori || []
  });
});

router.post('/admin/email', requireAuth, requireAdmin, async (req, res, next) => {
  const t = req.t, uid = req.user.id;
  const ok = [], erori = [];
  try {
    const b = req.body;
    const port = Number(b.port);
    const de = String(b.de || '').trim();
    if (de && !email.emailBun(de)) erori.push(t('prestator.eroareEmailDe'));
    if (b.port && !(Number.isInteger(port) && port > 0 && port < 65536)) erori.push(t('prestator.eroarePort'));
    if (!erori.length) {
      const pune = (k, v) => (v ? setari.pune(k, v, uid) : setari.sterge(k));
      pune('EMAIL_HOST', String(b.host || '').trim().slice(0, 200));
      pune('EMAIL_PORT', b.port ? String(port) : '');
      setari.pune('EMAIL_SECURE', b.secure === '1' ? '1' : '0', uid);
      pune('EMAIL_USER', String(b.user || '').trim().slice(0, 200));
      /* parola goală = rămâne cea veche; se șterge doar cu bifa anume */
      if (b.stergeParola === '1') setari.sterge('EMAIL_PAROLA');
      else if (b.parola) setari.pune('EMAIL_PAROLA', String(b.parola), uid);
      pune('EMAIL_DE', de);
      pune('EMAIL_NUME', String(b.nume || '').trim().slice(0, 80));
      pune('EMAIL_SUBIECT', String(b.subiect || '').trim().slice(0, 200));
      pune('EMAIL_TEXT', String(b.text || '').replace(/\r\n/g, '\n').trim().slice(0, 4000));
      ok.push(t('prestator.emailSalvat'));
      jurnal.fapta('email', 'setările de email schimbate', { req, detalii: { host: b.host, port: b.port } });

      /* Legătura se încearcă pe loc: o parolă greșită se vede acum, nu
         când trimite primul atelier o comandă. */
      if (email.pornit()) {
        try {
          await email.verifica();
          ok.push(t('prestator.legaturaOk'));
        } catch (e) {
          erori.push(t('prestator.legaturaEroare', { mesaj: e.message }));
        }
      }
    }
    req.session.emailFlash = { ok, erori };
    res.redirect('/admin/email');
  } catch (e) { next(e); }
});

/* Un email de probă, la adresa administratorului. */
router.post('/admin/email/proba', requireAuth, requireAdmin, async (req, res, next) => {
  const t = req.t;
  const ok = [], erori = [];
  try {
    await email.trimite({
      catre: req.user.email,
      subiect: t('prestator.probaSubiect'),
      text: t('prestator.probaText')
    });
    ok.push(t('prestator.probaTrimisa', { email: req.user.email }));
  } catch (e) {
    erori.push(t('prestator.legaturaEroare', { mesaj: e.message }));
  }
  req.session.emailFlash = { ok, erori };
  res.redirect('/admin/email');
});

/* ---------- Administrare → Prestatori ---------- */

router.get('/admin/prestatori', requireAuth, requireAdmin, (req, res) => {
  const flash = req.session.prestFlash || {};
  delete req.session.prestFlash;
  res.render('admin/prestatori', {
    title: req.t('prestator.adminTitlu'),
    prestatori: toti(),
    trimise: db.prepare("SELECT prestator_id, COUNT(*) AS n FROM trimiteri WHERE stare = 'trimis' GROUP BY prestator_id").all()
      .reduce((o, r) => { o[r.prestator_id] = r.n; return o; }, {}),
    emailPornit: email.pornit(),
    ok: flash.ok || [], erori: flash.erori || [], date: flash.date || null
  });
});

router.post('/admin/prestatori', requireAuth, requireAdmin, (req, res) => {
  const id = req.body.id ? Number(req.body.id) : 0;
  if (id && !unul(id)) return res.redirect('/admin/prestatori');
  const erori = salveaza(id, req.body);
  if (erori.length) {
    req.session.prestFlash = { erori: erori.map(k => req.t(k)), date: Object.assign({}, req.body) };
  } else {
    req.session.prestFlash = { ok: [req.t('prestator.salvat')] };
    jurnal.fapta('email', id ? 'prestator schimbat' : 'prestator adăugat', { req, detalii: { nume: req.body.nume } });
  }
  res.redirect('/admin/prestatori');
});

router.post('/admin/prestatori/:id/sterge', requireAuth, requireAdmin, (req, res) => {
  const p = unul(req.params.id);
  if (p) {
    /* istoricul trimiterilor rămâne: are numele și adresa copiate */
    db.prepare('DELETE FROM prestatori WHERE id = ?').run(p.id);
    req.session.prestFlash = { ok: [req.t('prestator.sters', { nume: p.nume })] };
    jurnal.fapta('email', 'prestator șters', { req, detalii: { nume: p.nume } });
  }
  res.redirect('/admin/prestatori');
});

module.exports = {
  router, PE_ZI, activi, toti, unul, salveaza, atelier, completeaza, propunere,
  aleComenzii, azi, noteaza
};
