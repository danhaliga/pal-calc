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
  STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
  /* Pe un disc care rămâne între urcările de versiune, în afara dosarului
     aplicației. Fără el, verificarea oprește pornirea — și bine face. */
  DATA_DIR: '/var/date',
  APP_ROOT: '/app'
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

test('creditul virtual pe public nu oprește site-ul, dar se spune', () => {
  /* Driverul și cheile se aleg din Administrare → Plata: dacă lipsa lor ar
     opri pornirea, n-ai avea unde să le pui. Iar creditul virtual pe un site
     public e o alegere a administratorului, cât timp aplicația se probează. */
  const r = cu({ PAYMENT_DRIVER: 'fake' });
  assert.deepEqual(r.opriri, []);
  assert.ok(r.semne.some(s => /PAYMENT_DRIVER/.test(s) && /Administrare/.test(s)));
});

test('Stripe fără chei se spune, cu locul unde se pun', () => {
  const a = cu({ STRIPE_SECRET_KEY: '' });
  assert.deepEqual(a.opriri, []);
  assert.ok(a.semne.some(s => /STRIPE_SECRET_KEY/.test(s) && /Administrare/.test(s)));
  const b = cu({ STRIPE_WEBHOOK_SECRET: '' });
  assert.ok(b.semne.some(s => /WEBHOOK/.test(s) && /Administrare/.test(s)));
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
  assert.ok(r.opriri.length >= 2);
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

/* =====================================================================
   Curățarea conturilor de test

   Testele care trec prin HTTP își fac cont ca să aibă sesiune și nu și-l
   strâng după ele. Se adunaseră 435 — printre ele, omul adevărat nu se mai
   găsea în panoul de administrare.
   ===================================================================== */

const CURATA = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'curata-teste.js'), 'utf8');

test('curățarea merge pe domeniu, nu pe prefix', () => {
  /* Testele folosesc vreo șaizeci de prefixe și fiecare test nou mai
     inventează unul. `local.test` e rezervat prin RFC 6761: nimeni adevărat
     n-are adresă acolo. */
  assert.match(CURATA, /const DOMENIU = '@local\.test'/);
  assert.match(CURATA, /u\.email LIKE \?/);
  assert.ok(!/email LIKE 'test%'|email LIKE 'verif%'/.test(CURATA),
    'a apărut un tipar pe prefix, care rămâne în urmă la primul test nou');
});

test('nu se șterge niciun administrator, și nici contul de seed', () => {
  assert.match(CURATA, /u\.is_admin = 0/, 'administratorii nu mai sunt feriți');
  assert.match(CURATA, /u\.email <> \?/, 'contul de seed nu mai e ferit');
  assert.match(CURATA, /process\.env\.ADMIN_EMAIL/);
});

test('fără --sterge nu se atinge nimic', () => {
  /* Rulată din greșeală, comanda trebuie să fie inofensivă. */
  const poz = CURATA.indexOf("if (!chiar)");
  const pozSterge = CURATA.indexOf('DELETE FROM users');
  assert.ok(poz !== -1 && pozSterge !== -1);
  assert.ok(poz < pozSterge, 'ștergerea se poate întâmpla fără --sterge');
  assert.match(CURATA, /process\.exit\(0\)/);
});

test('ștergerea e o singură tranzacție', () => {
  /* Ori pleacă toate, ori niciunul: o curățare oprită la jumătate lasă
     comenzi fără stăpân. */
  assert.match(CURATA, /db\.transaction\(/);
});

test('curățarea se face singură după teste', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.match(pkg.scripts.posttest || '', /curata-teste\.js --sterge/,
    'nimeni n-o să-și amintească s-o ruleze de mână — de-aia s-au adunat 435');
  assert.ok(pkg.scripts['curata-teste'], 'lipsește varianta care doar arată ce ar șterge');
});

/* =====================================================================
   Unde stă baza de date

   Pe un server adevărat, dosarul aplicației se înlocuiește la fiecare
   urcare de versiune. O bază lăsată înăuntru pleacă odată cu el, în tăcere:
   aplicația pornește frumos, doar că e goală, iar nimeni nu leagă paguba de
   urcare fiindcă între ele au trecut zile.
   ===================================================================== */

const { eInAfara } = require('../src/pornire');

test('un dosar care doar SEAMĂNĂ la text nu e înăuntru', () => {
  /* Capcana: „/app-date" începe cu „/app" ca text, dar e alt dosar. O
     comparație pe șiruri l-ar respinge pe nedrept. */
  assert.equal(eInAfara('/app-date', '/app'), true);
  assert.equal(eInAfara('/app/data', '/app'), false);
  assert.equal(eInAfara('/app/a/b/date', '/app'), false);
  assert.equal(eInAfara('/var/date', '/app'), true);
  assert.equal(eInAfara('/app', '/app'), false, 'chiar rădăcina e tot înăuntru');
  assert.equal(eInAfara('/app/', '/app'), false, 'bara din coadă nu schimbă nimic');
});

test('barele inverse se socotesc la fel cu cele drepte', () => {
  /* Bara inversă e scrisă cu codul ei: heredoc-urile din Git Bash au
     mâncat-o de trei ori în proiectul ăsta. Vezi și nota din regresii. */
  const bs = String.fromCharCode(92);
  assert.equal(eInAfara('C:' + bs + 'x' + bs + 'date', 'C:' + bs + 'x'), false);
  assert.equal(eInAfara('C:' + bs + 'y' + bs + 'date', 'C:' + bs + 'x'), true);
});

test('în producție, baza de date nu are voie să stea în dosarul aplicației', () => {
  const env = Object.assign({}, BUN, { APP_ROOT: '/app' });

  /* `BUN` îl are pus, deci ca să probăm lipsa lui trebuie scos anume. */
  const faraDir = Object.assign({}, env);
  delete faraDir.DATA_DIR;
  const fara = verifica(faraDir, []);
  assert.ok(fara.opriri.some(o => /DATA_DIR/.test(o)), 'lipsa lui DATA_DIR trece nebăgată în seamă');

  const inauntru = verifica(Object.assign({}, env, { DATA_DIR: '/app/data' }), []);
  assert.ok(inauntru.opriri.some(o => /DATA_DIR/.test(o)), 'o bază în dosarul aplicației trece');

  const bine = verifica(Object.assign({}, env, { DATA_DIR: '/var/date' }), []);
  assert.deepEqual(bine.opriri, [], `se plânge degeaba: ${bine.opriri.join(' | ')}`);
});

test('local nu se cere nimic: baza stă lângă cod și e în regulă', () => {
  const r = verifica({ APP_URL: 'http://localhost:3000', PAYMENT_DRIVER: 'fake' }, []);
  assert.ok(!r.opriri.length);
  assert.ok(!r.semne.some(s => /DATA_DIR/.test(s)), 'bate la cap degeaba pe calculatorul omului');
});

test('baza chiar ascultă de DATA_DIR', () => {
  /* Fără asta, verificarea de mai sus ar păzi o setare pe care n-o citește
     nimeni. */
  const sursa = fs.readFileSync(path.join(__dirname, '..', 'src', 'db.js'), 'utf8');
  assert.match(sursa, /process\.env\.DATA_DIR/);
  assert.match(sursa, /path\.resolve\(process\.env\.DATA_DIR\)/);
});

test('fișierul pentru Render leagă discul de DATA_DIR', () => {
  /* Dacă cele două nu arată spre același loc, discul rămâne gol și baza tot
     în dosarul care se șterge. */
  const y = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');
  const mount = (y.match(/mountPath:\s*(\S+)/) || [])[1];
  const dataDir = (y.match(/key:\s*DATA_DIR[\s\S]{0,60}?value:\s*(\S+)/) || [])[1];
  assert.ok(mount, 'nu mai e declarat niciun disc');
  assert.equal(dataDir, mount, `DATA_DIR (${dataDir}) nu arată spre discul montat (${mount})`);
  assert.match(y, /healthCheckPath:\s*\/sanatate/);
  assert.match(y, /generateValue:\s*true/, 'secretul de sesiune nu se mai generează singur');
});

test('ruta de sănătate atinge baza, nu spune doar „sunt viu"', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const ruta = s.match(/app\.get\('\/sanatate'[\s\S]*?\n\}\);/);
  assert.ok(ruta, 'nu mai există ruta de sănătate');
  assert.match(ruta[0], /db\.prepare/, 'răspunde fără să verifice baza');
  assert.match(ruta[0], /503/, 'nu spune nimănui când baza e căzută');
});
