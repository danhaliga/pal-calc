'use strict';
/* Setările care se schimbă din panoul de administrare.
   ============================================================

   Până acum cheile Stripe stăteau doar în .env, pe server. Ca să le pui
   trebuia să intri pe server și să editezi un fișier — exact lucrul pe care
   omul care conduce atelierul nu-l face și nici n-ar trebui să-l facă.

   Acum se pun din Administrare → Plata. Regula de citire e una singură:
   CE E ÎN APLICAȚIE BATE CE E ÎN .env. Fișierul rămâne rezervă, ca să
   meargă mai departe locurile unde cheile sunt deja puse acolo (Render).

   Cele secrete se scriu criptate (AES-256-GCM), cu o cheie scoasă din
   SESSION_SECRET. O copie a bazei de date luată pentru o probă nu trebuie
   să fie și cheia contului de bani. Prețul: dacă SESSION_SECRET se schimbă,
   cheile vechi nu se mai pot citi. Nu se pierde nimic altceva — aplicația
   se poartă ca și cum n-ar fi puse, și pagina de plată spune să fie puse
   din nou.
   ============================================================ */

const crypto = require('crypto');
const { db } = require('./db');

/* Singurele chei care se pot pune din aplicație. Orice altceva rămâne în
   .env: adresa site-ului sau secretul de sesiune se citesc la pornire, și o
   schimbare din pagină n-ar prinde decât după repornire — adică ar părea
   că nu merge. */
const PERMISE = ['PAYMENT_DRIVER', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
                 /* facturarea: plătitor de TVA ('1'/'0') și cota, în procente */
                 'FACTURARE_TVA', 'FACTURARE_COTA',
                 /* emailul: serverul SMTP și mesajul implicit către prestatori */
                 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PAROLA',
                 'EMAIL_DE', 'EMAIL_NUME', 'EMAIL_SUBIECT', 'EMAIL_TEXT',
                 /* prețul scris pe paginile de prezentare („1 €"); plata rămâne în lei */
                 'PRET_PUBLIC'];
const SECRETE = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'EMAIL_PAROLA'];

const SECRET_IMPLICIT = 'dev-secret-schimba-ma';   /* același ca în server.js */

function cheieCriptare(secret) {
  const s = secret || process.env.SESSION_SECRET || SECRET_IMPLICIT;
  return crypto.createHash('sha256').update('palcalc/setari/' + s).digest();
}

function cripteaza(text, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cheieCriptare(secret), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

/* null dacă nu se poate citi — alt SESSION_SECRET, sau text stricat. */
function decripteaza(s, secret) {
  try {
    const p = String(s).split(':');
    if (p.length !== 4 || p[0] !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', cheieCriptare(secret), Buffer.from(p[1], 'base64'));
    d.setAuthTag(Buffer.from(p[2], 'base64'));
    return Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

/* Setările se citesc la fiecare cerere care atinge plata. Le ținem în
   memorie și le recitim doar după o scriere — aplicația rulează într-un
   singur proces, deci nu are cine să le schimbe pe la spate. */
let cache = null;

function incarca() {
  const valori = {};
  const necitite = [];
  db.prepare('SELECT cheie, valoare FROM setari').all().forEach(function (r) {
    if (SECRETE.indexOf(r.cheie) === -1) { valori[r.cheie] = r.valoare; return; }
    const v = decripteaza(r.valoare);
    if (v === null) necitite.push(r.cheie); else valori[r.cheie] = v;
  });
  return { valori: valori, necitite: necitite };
}

function stare() {
  if (!cache) cache = incarca();
  return cache;
}

/* Valoarea care se folosește: din aplicație, altfel din .env, altfel ''. */
function citeste(cheie) {
  const v = stare().valori[cheie];
  if (v !== undefined && v !== '') return v;
  return process.env[cheie] || '';
}

/* De unde vine valoarea: 'aplicatie', 'env' sau '' (nicăieri). */
function sursa(cheie) {
  const v = stare().valori[cheie];
  if (v !== undefined && v !== '') return 'aplicatie';
  return process.env[cheie] ? 'env' : '';
}

/* Cheile salvate care nu se mai pot citi (s-a schimbat SESSION_SECRET). */
function necitite() {
  return stare().necitite.slice();
}

function pune(cheie, valoare, userId) {
  if (PERMISE.indexOf(cheie) === -1) throw new Error('setare necunoscută: ' + cheie);
  const v = SECRETE.indexOf(cheie) !== -1 ? cripteaza(valoare) : String(valoare);
  db.prepare(
    'INSERT INTO setari (cheie, valoare, updated_by) VALUES (?, ?, ?) ' +
    "ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare, updated_by = excluded.updated_by, updated_at = datetime('now')"
  ).run(cheie, v, userId == null ? null : userId);
  cache = null;
}

function sterge(cheie) {
  db.prepare('DELETE FROM setari WHERE cheie = ?').run(cheie);
  cache = null;
}

/* Mediul văzut de verificările de pornire: .env, cu setările din aplicație
   puse peste. */
function mediu(env) {
  return Object.assign({}, env || process.env, stare().valori);
}

/* „sk_live_…3f9a" — destul cât să recunoști cheia, nu cât s-o poți folosi. */
function mascheaza(v) {
  const s = String(v || '');
  if (!s) return '';
  const pref = (s.match(/^[a-z]+_(live|test)_|^[a-z]+_/) || [''])[0];
  return pref + '…' + s.slice(-4);
}

module.exports = {
  PERMISE, SECRETE, citeste, sursa, necitite, pune, sterge, mediu, mascheaza,
  cripteaza, decripteaza
};
