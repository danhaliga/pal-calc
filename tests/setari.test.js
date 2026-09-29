'use strict';
/* Setările din Administrare → Plata.

   Trei lucruri păzite aici, fiecare mai rău decât lipsa paginii dacă se
   strică: o cheie Stripe care ajunge în clar în baza de date sau pe ecran,
   o setare din aplicație pe care plata n-o ascultă (pagina ar spune
   „salvat" și nimic nu s-ar schimba), și Stripe pornit cu o cheie lipsă
   care ar cădea pe credit gratis. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Baza de date a testului e una nouă, într-un dosar temporar. NU cea de pe
   calculatorul omului: testele de-aici scriu driverul de plată, iar acolo ar
   schimba felul în care îi merge aplicația. Trebuie pus înainte de primul
   require('../src/db'). */
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palcalc-setari-'));
process.env.DATA_DIR = DIR;
process.env.SESSION_SECRET = 'x'.repeat(48);
delete process.env.PAYMENT_DRIVER;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;

const { db, migrate } = require('../src/db');
migrate(() => {});
const setari = require('../src/setari');
const plati = require('../src/payments');

test.after(() => {
  db.close();
  fs.rmSync(DIR, { recursive: true, force: true });
});

const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

/* ---------------- cheile nu stau în clar ---------------- */

test('cheia Stripe se scrie criptată în baza de date', () => {
  setari.pune('STRIPE_SECRET_KEY', 'sk_live_abcdefghijklmnop1234', 1);
  const r = db.prepare("SELECT valoare FROM setari WHERE cheie = 'STRIPE_SECRET_KEY'").get();
  assert.ok(r, 'nu s-a scris nimic');
  assert.ok(r.valoare.indexOf('sk_live_') === -1, 'cheia stă în clar în baza de date');
  assert.equal(setari.citeste('STRIPE_SECRET_KEY'), 'sk_live_abcdefghijklmnop1234');
  setari.sterge('STRIPE_SECRET_KEY');
});

test('cu alt SESSION_SECRET cheia nu se mai poate citi, și nu se inventează nimic', () => {
  const c = setari.cripteaza('sk_live_ceva', 'a'.repeat(40));
  assert.equal(setari.decripteaza(c, 'a'.repeat(40)), 'sk_live_ceva');
  assert.equal(setari.decripteaza(c, 'b'.repeat(40)), null);
  assert.equal(setari.decripteaza('text stricat'), null);
});

test('o cheie care nu se mai poate citi se spune, nu se folosește', () => {
  db.prepare("INSERT INTO setari (cheie, valoare) VALUES ('STRIPE_WEBHOOK_SECRET', ?)")
    .run(setari.cripteaza('whsec_vechi', 'alt-secret-de-sesiune-lung-de-tot'));
  setari.pune('PAYMENT_DRIVER', 'fake', 1);            /* golește memoria */
  assert.deepEqual(setari.necitite(), ['STRIPE_WEBHOOK_SECRET']);
  assert.equal(setari.citeste('STRIPE_WEBHOOK_SECRET'), '');
  setari.sterge('STRIPE_WEBHOOK_SECRET');
  assert.deepEqual(setari.necitite(), []);
});

test('pe ecran cheia apare doar prescurtată', () => {
  assert.equal(setari.mascheaza('sk_live_abcdefghijklmnop1234'), 'sk_live_…1234');
  assert.equal(setari.mascheaza('whsec_abcdefghijk9876'), 'whsec_…9876');
  assert.equal(setari.mascheaza(''), '');
});

test('pagina nu pune niciodată cheia întreagă în HTML', () => {
  const v = citeste('views', 'admin', 'plata.ejs');
  assert.ok(!/value="<%=\s*cheie/.test(v) && !/value="<%=\s*webhook/.test(v),
    'un câmp are cheia ca valoare');
  /* ruta dă paginii doar masca, nu valoarea */
  const r = citeste('src', 'admin.js');
  assert.match(r, /masca: setari\.mascheaza\(cheie\)/);
  assert.ok(!/cheie: cheie[,\s}]/.test(r), 'ruta trimite cheia întreagă în pagină');
});

/* ---------------- ce e în aplicație bate .env ---------------- */

test('setarea din aplicație bate .env, iar .env rămâne rezervă', () => {
  process.env.PAYMENT_DRIVER = 'stripe';
  setari.sterge('PAYMENT_DRIVER');
  assert.equal(setari.citeste('PAYMENT_DRIVER'), 'stripe');
  assert.equal(setari.sursa('PAYMENT_DRIVER'), 'env');

  setari.pune('PAYMENT_DRIVER', 'fake', 1);
  assert.equal(setari.citeste('PAYMENT_DRIVER'), 'fake');
  assert.equal(setari.sursa('PAYMENT_DRIVER'), 'aplicatie');
  assert.equal(plati.driver(), 'fake', 'plata nu ascultă de setarea din aplicație');

  delete process.env.PAYMENT_DRIVER;
  setari.sterge('PAYMENT_DRIVER');
});

test('verificările de pornire văd setările din aplicație', () => {
  setari.pune('STRIPE_SECRET_KEY', 'sk_live_abcdefghijklmnop1234', 1);
  const m = setari.mediu({ APP_URL: 'https://cutmodul.com' });
  assert.equal(m.STRIPE_SECRET_KEY, 'sk_live_abcdefghijklmnop1234');
  assert.equal(m.APP_URL, 'https://cutmodul.com');
  setari.sterge('STRIPE_SECRET_KEY');
  assert.match(citeste('server.js'), /setari'\)\.mediu\(process\.env\)/);
});

test('din aplicație nu se pot pune decât setările de plată', () => {
  assert.throws(() => setari.pune('SESSION_SECRET', 'x', 1));
  assert.throws(() => setari.pune('APP_URL', 'http://rau', 1));
});

/* ---------------- când se poate alimenta creditul ---------------- */

test('creditul virtual merge cât timp e ales, și pe un site public', () => {
  /* Alegerea administratorului, cât timp aplicația se probează. */
  const vechi = process.env.APP_URL;
  process.env.APP_URL = 'https://cutmodul.com';
  setari.pune('PAYMENT_DRIVER', 'fake', 1);
  const s = plati.stare();
  assert.equal(s.driver, 'fake');
  assert.equal(s.public, true);
  assert.equal(s.pornita, true);
  if (vechi === undefined) delete process.env.APP_URL; else process.env.APP_URL = vechi;
});

test('Stripe cu o cheie lipsă oprește alimentarea, nu cade pe credit gratis', () => {
  setari.pune('PAYMENT_DRIVER', 'stripe', 1);
  assert.equal(plati.stare().pornita, false);

  setari.pune('STRIPE_SECRET_KEY', 'sk_live_abcdefghijklmnop1234', 1);
  assert.equal(plati.stare().pornita, false, 'a pornit fără secretul webhook-ului');

  setari.pune('STRIPE_WEBHOOK_SECRET', 'whsec_abcdefghijklmnop', 1);
  const s = plati.stare();
  assert.equal(s.pornita, true);
  assert.equal(s.mod, 'live');

  ['PAYMENT_DRIVER', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].forEach(k => setari.sterge(k));
});

test('ruta de alimentare întreabă de stare înainte de orice', () => {
  const s = citeste('src', 'credit.js');
  const topup = s.slice(s.indexOf("router.post('/credit/topup'"));
  assert.ok(topup.indexOf('stare.pornita') !== -1, 'alimentarea nu verifică dacă plata e pornită');
  assert.ok(topup.indexOf('stare.pornita') < topup.indexOf("'fake'"),
    'driverul fals se folosește înainte de verificare');
});

/* ---------------- formatul cheilor ---------------- */

test('se primesc doar chei care arată a chei Stripe', () => {
  assert.ok(plati.FORMAT_CHEIE.test('sk_live_51AbCdEfGhIjKlMn'));
  assert.ok(plati.FORMAT_CHEIE.test('sk_test_51AbCdEfGhIjKlMn'));
  assert.ok(plati.FORMAT_CHEIE.test('rk_live_51AbCdEfGhIjKlMn'));
  /* cheia publică se lipește des din greșeală: e pe același ecran */
  assert.ok(!plati.FORMAT_CHEIE.test('pk_live_51AbCdEfGhIjKlMn'));
  assert.ok(!plati.FORMAT_CHEIE.test('sk_live_ cu spatiu'));
  assert.ok(plati.FORMAT_WEBHOOK.test('whsec_AbCdEfGhIjKlMn'));
  assert.ok(!plati.FORMAT_WEBHOOK.test('we_AbCdEfGhIjKlMn'));
});

/* ---------------- pagina ---------------- */

test('pagina e doar pentru administratori', () => {
  const s = citeste('src', 'admin.js');
  assert.match(s, /router\.get\('\/admin\/plata', requireAuth, requireAdmin/);
  assert.match(s, /router\.post\('\/admin\/plata', requireAuth, requireAdmin/);
});

test('ștergerea cheilor cere confirmare prin fereastra paginii', () => {
  /* window.confirm() nu răspunde în panoul din aplicație */
  assert.match(citeste('views', 'admin', 'plata.ejs'), /name="sterge"[^>]*data-confirma=/);
});

test('fiecare text folosit de pagină există în română', () => {
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const chei = new Set();
  const rx = /t\('(admin\.plata\.[A-Za-z]+)'/g;
  let m;
  [citeste('views', 'admin', 'plata.ejs'), citeste('src', 'admin.js'), citeste('views', 'admin.ejs')]
    .forEach(s => { while ((m = rx.exec(s))) chei.add(m[1]); });
  assert.ok(chei.size > 20, 'n-a găsit cheile paginii');
  chei.forEach(k => {
    const v = k.split('.').reduce((o, p) => (o == null ? o : o[p]), ro);
    assert.equal(typeof v, 'string', `lipsește ${k}`);
  });
});
