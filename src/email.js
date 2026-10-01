'use strict';
/* Trimiterea emailurilor.
   ============================================================

   Setările serverului de email (SMTP) se pun din Administrare → Email, ca
   cheile Stripe: nu în .env, nu pe server. Parola se scrie criptată (vezi
   src/setari.js). Orice furnizor merge — Gmail cu parolă de aplicație,
   contul de email al firmei de la găzduire, Brevo, Mailgun — toate dau un
   server SMTP, un port, un utilizator și o parolă.

   Pentru probe (teste, server de probă) EMAIL_PROBA=1 în mediu: emailurile
   nu pleacă nicăieri, se scriu ca fișiere în DATA_DIR/emailuri-proba.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const setari = require('./setari');

const CHEI = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PAROLA', 'EMAIL_DE', 'EMAIL_NUME'];

const EMAIL_BUN = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const emailBun = s => EMAIL_BUN.test(String(s || '').trim());

function eProba() {
  return process.env.EMAIL_PROBA === '1';
}

function config() {
  const port = Number(setari.citeste('EMAIL_PORT')) || 587;
  return {
    host: setari.citeste('EMAIL_HOST'),
    port,
    /* 465 = conexiune criptată de la început; 587 = STARTTLS */
    secure: setari.citeste('EMAIL_SECURE') ? setari.citeste('EMAIL_SECURE') === '1' : port === 465,
    user: setari.citeste('EMAIL_USER'),
    parola: setari.citeste('EMAIL_PAROLA'),
    de: setari.citeste('EMAIL_DE') || setari.citeste('EMAIL_USER'),
    nume: setari.citeste('EMAIL_NUME') || 'CutModul'
  };
}

/* Se poate trimite? Server, adresă de expeditor și (dacă e utilizator) parolă. */
function pornit() {
  if (eProba()) return true;
  const c = config();
  return !!(c.host && emailBun(c.de) && (!c.user || c.parola));
}

function transport(c) {
  if (eProba()) return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.parola } : undefined,
    /* un server de email care nu răspunde nu ține pagina omului un minut */
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000
  });
}

/* Verifică legătura și parola, fără să trimită nimic. */
async function verifica() {
  if (eProba()) return true;
  return transport(config()).verify();
}

function salveazaProba(mesaj, info, atasamente) {
  const { DATA_DIR } = require('./db');
  const dir = path.join(DATA_DIR, 'emailuri-proba');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.json');
  fs.writeFileSync(f, JSON.stringify({
    catre: mesaj.to, cc: mesaj.cc, raspunsLa: mesaj.replyTo, de: info.envelope && info.envelope.from,
    subiect: mesaj.subject, text: mesaj.text,
    atasamente
  }, null, 2));
}

/* mesaj: { catre, cc, raspunsLa, subiect, text, atasamente: [{ nume, continut }] } */
async function trimite(mesaj) {
  if (!pornit()) throw new Error('emailul nu e configurat');
  const c = config();
  const m = {
    from: { name: c.nume, address: eProba() ? 'proba@palcalc.local' : c.de },
    to: mesaj.catre,
    cc: mesaj.cc || undefined,
    replyTo: mesaj.raspunsLa || undefined,
    subject: mesaj.subiect,
    text: mesaj.text,
    attachments: (mesaj.atasamente || []).map(a => ({ filename: a.nume, content: a.continut }))
  };
  /* mărimile se iau înainte: la trimitere atașamentele se transformă */
  const atas = m.attachments.map(a => ({ nume: a.filename, octeti: a.content.length }));
  const info = await transport(c).sendMail(m);
  if (eProba()) salveazaProba(m, info, atas);
  return info;
}

module.exports = { CHEI, config, pornit, verifica, trimite, emailBun, eProba };
