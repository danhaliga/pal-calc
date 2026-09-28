'use strict';
/* Verificările de dinainte de deschiderea portului.

   Toate testele de-aici întreabă același lucru din unghiuri diferite: poate
   aplicația să pornească liniștită pe un domeniu public cu o configurație
   care lasă ușa deschisă? Răspunsul trebuie să fie nu. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { verifica, aplica, estePublic, eLocal, LUNGIME_MINIMA_SECRET } = require('../src/pornire');

const BUN = {
  APP_URL: 'https://cutmodul.com',
  SESSION_SECRET: 'x'.repeat(LUNGIME_MINIMA_SECRET + 16),
  PAYMENT_DRIVER: 'stripe',
  STRIPE_SECRET_KEY: 'sk_live_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx'
};
const cu = over => verifica(Object.assign({}, BUN, over), []);

/* ---------------- ce e „public" ---------------- */

test('adresele locale nu sunt publice', () => {
  ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000',
   'http://0.0.0.0:3000', ''].forEach(u => assert.ok(eLocal(u), `${u} trecut drept public`));
});

test('un domeniu adevărat înseamnă public, chiar fără NODE_ENV', () => {
  /* Cazul adevărat: omul își pune domeniul în .env și uită de restul. Dacă
     ne-am uita doar la NODE_ENV, verificările ar tăcea exact atunci. */
  assert.ok(!eLocal('https://cutmodul.com'));
  assert.ok(estePublic({ APP_URL: 'https://cutmodul.com' }));
  assert.ok(estePublic({ APP_URL: 'http://cutmodul.com' }));
  assert.ok(estePublic({ NODE_ENV: 'production', APP_URL: 'http://localhost:3000' }));
  assert.ok(!estePublic({ APP_URL: 'http://localhost:3000' }));
});

test('„localhost.cutmodul.com" nu e localhost', () => {
  /* Un nume care doar începe cu localhost e alt calculator. */
  assert.ok(!eLocal('http://localhost.cutmodul.com'));
  assert.ok(!eLocal('http://127.0.0.1.altcineva.ro'));
});

/* ---------------- ce oprește pornirea ---------------- */

test('o configurație bună trece fără nimic de spus', () => {
  const r = cu({});
  assert.deepEqual(r.opriri, []);
  assert.deepEqual(r.semne, []);
});

test('secretul din .env.example oprește pornirea pe public', () => {
  const r = cu({ SESSION_SECRET: 'schimba-ma-cu-un-secret-lung-si-aleatoriu' });
  assert.equal(r.opriri.length, 1);
  assert.match(r.opriri[0], /SESSION_SECRET/);
});

test('secretul scris în cod oprește la fel', () => {
  /* E valoarea pe care o pune server.js când variabila lipsește. */
  assert.equal(cu({ SESSION_SECRET: 'dev-secret-schimba-ma' }).opriri.length, 1);
});

test('un secret scurt nu e secret', () => {
  assert.equal(cu({ SESSION_SECRET: 'abc' }).opriri.length, 1);
  assert.equal(cu({ SESSION_SECRET: 'x'.repeat(LUNGIME_MINIMA_SECRET - 1) }).opriri.length, 1);
  assert.equal(cu({ SESSION_SECRET: 'x'.repeat(LUNGIME_MINIMA_SECRET) }).opriri.length, 0);
});

test('http pe un domeniu public oprește pornirea', () => {
  const r = cu({ APP_URL: 'http://cutmodul.com' });
  assert.ok(r.opriri.some(o => /https/.test(o)), 'nu se plânge de http');
});

test('driverul fals pe public oprește pornirea', () => {
  /* Cu el, oricine își pune singur credit. E bani, nu comoditate. */
  const r = cu({ PAYMENT_DRIVER: 'fake' });
  assert.ok(r.opriri.some(o => /PAYMENT_DRIVER/.test(o)));
});

test('Stripe fără chei oprește pornirea', () => {
  assert.ok(cu({ STRIPE_SECRET_KEY: '' }).opriri.some(o => /STRIPE_SECRET_KEY/.test(o)));
  assert.ok(cu({ STRIPE_WEBHOOK_SECRET: '' }).opriri.some(o => /WEBHOOK/.test(o)));
});

test('cheia de test Stripe se spune, dar nu oprește', () => {
  /* Se poate rula un magazin în modul de test înadins, o vreme. */
  const r = cu({ STRIPE_SECRET_KEY: 'sk_test_xxx' });
  assert.deepEqual(r.opriri, []);
  assert.ok(r.semne.some(s => /test/.test(s)));
});

/* ---------------- conturile de administrator ---------------- */

test('un administrator cu parola din exemplu oprește pornirea', () => {
  /* Verificarea e adevărată, nu după nume: se compară cu bcrypt. */
  const admini = [{ email: 'admin@local.test', password_hash: bcrypt.hashSync('admin1234', 8) }];
  const r = verifica(Object.assign({}, BUN), admini);
  assert.equal(r.opriri.length, 1);
  assert.match(r.opriri[0], /admin@local\.test/);
});

test('un administrator cu parolă schimbată nu deranjează pe nimeni', () => {
  const admini = [{ email: 'dan@cutmodul.com', password_hash: bcrypt.hashSync('cu totul altceva', 8) }];
  assert.deepEqual(verifica(Object.assign({}, BUN), admini).opriri, []);
});

test('un hash stricat nu dărâmă pornirea', () => {
  /* bcrypt aruncă pe ce nu înțelege; asta n-are voie să oprească aplicația. */
  const admini = [{ email: 'x@y.ro', password_hash: 'nu-e-un-hash' }];
  assert.doesNotThrow(() => verifica(Object.assign({}, BUN), admini));
});

/* ---------------- pe calculatorul omului ---------------- */

test('local, aceleași lucruri doar avertizează', () => {
  /* Un server de dezvoltare trebuie să pornească și cu valorile implicite:
     altfel prima lucrare a zilei începe cu o eroare de configurare. */
  const r = verifica({ APP_URL: 'http://localhost:3000', PAYMENT_DRIVER: 'fake' }, []);
  assert.deepEqual(r.opriri, [], 'a oprit pornirea pe calculatorul omului');
  assert.ok(r.semne.length >= 2, 'nu spune nimic nici local');
});

test('aplica() întoarce fals doar când chiar oprește', () => {
  const taci = () => {};
  assert.equal(aplica({ opriri: [], semne: ['ceva'] }, taci), true);
  assert.equal(aplica({ opriri: ['rău'], semne: [] }, taci), false);
});

test('fiecare oprire numește setarea de reparat', () => {
  /* Omul citește mesajul în consolă și trebuie să știe la ce rând din .env
     să se uite. Lungimea mesajului nu spune nimic despre asta. */
  const r = cu({ SESSION_SECRET: 'abc', APP_URL: 'http://cutmodul.com', PAYMENT_DRIVER: 'fake' });
  assert.ok(r.opriri.length >= 3);
  r.opriri.forEach(o => {
    assert.match(o, /SESSION_SECRET|APP_URL|PAYMENT_DRIVER|STRIPE_[A-Z_]+|administrator/,
      `mesaj care nu spune ce setare e de schimbat: „${o}"`);
  });
});

/* ---------------- legătura cu serverul ---------------- */

test('serverul chiar cheamă verificarea înainte să deschidă portul', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const poz = i => s.indexOf(i);
  assert.ok(poz("require('./src/pornire')") !== -1, 'verificarea nu mai e chemată');
  assert.ok(poz('pornire.aplica') < poz('app.listen(PORT'),
    'portul se deschide înainte de verificare');
  assert.match(s, /process\.exit\(1\)/, 'nu se mai oprește, doar scrie');
});

test('.env.example spune limpede că valorile lui sunt publice', () => {
  const ex = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  assert.match(ex, /REFUZA sa porneasca/);
  assert.match(ex, /src\/pornire\.js/);
});
