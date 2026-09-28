'use strict';
/* Jurnalul aplicației.

   Trei reguli pe care testele de-aici le țin în frâu, fiindcă fiecare din
   ele, încălcată, e mai rea decât lipsa jurnalului cu totul:
   nu dărâmă aplicația, nu scrie secrete, nu crește la nesfârșit. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { adresaTrunchiata, curata, eInterzis, NIVELE } = require('../src/jurnal');

const SURSA = fs.readFileSync(path.join(__dirname, '..', 'src', 'jurnal.js'), 'utf8');

/* ---------------- nu scrie secrete ---------------- */

test('câmpurile cu secrete se recunosc după nume, oricum ar fi scrise', () => {
  ['parola', 'Parola', 'password', 'userPassword', 'secret', 'STRIPE_SECRET_KEY',
   'token', 'accessToken', 'cookie', 'authorization', 'csrfToken', 'apiKey',
   'api_key', 'password_hash', 'cardNumber', 'iban'].forEach(k => {
    assert.ok(eInterzis(k), `„${k}" ar ajunge în jurnal`);
  });
});

test('câmpurile obișnuite trec', () => {
  ['nume', 'email', 'id', 'status', 'ruta', 'lungime', 'corpuri'].forEach(k => {
    assert.ok(!eInterzis(k), `„${k}" e ascuns degeaba`);
  });
});

test('un secret îngropat adânc tot se ascunde', () => {
  /* Cazul adevărat: nimeni nu pune parola la rădăcină, ea vine îngropată
     într-un obiect de cerere. */
  const c = curata({
    nivel1: { nivel2: { nivel3: { parola: 'taina', nume: 'Dan' } } },
    lista: [{ token: 'abc' }, { ok: 1 }]
  });
  assert.equal(c.nivel1.nivel2.nivel3.parola, '[ascuns]');
  assert.equal(c.nivel1.nivel2.nivel3.nume, 'Dan', 'a ascuns și ce nu trebuia');
  assert.equal(c.lista[0].token, '[ascuns]');
  assert.equal(c.lista[1].ok, 1);
});

test('un obiect legat în cerc nu blochează scrierea', () => {
  const a = { nume: 'x' };
  a.eu = a;
  assert.doesNotThrow(() => JSON.stringify(curata(a)));
});

test('o eroare se păstrează cu urma ei, nu ca obiect gol', () => {
  /* `JSON.stringify(new Error(...))` dă „{}" — informația se pierde exact
     când e mai necesară. */
  const c = curata(new Error('s-a rupt ceva'));
  assert.equal(c.mesaj, 's-a rupt ceva');
  assert.match(c.urma, /Error: s-a rupt ceva/);
});

test('textele lungi se taie, ca un rând să nu umple discul', () => {
  const c = curata({ text: 'x'.repeat(50000) });
  assert.ok(c.text.length < 2100, `a scris ${c.text.length} caractere`);
});

/* ---------------- adresele ---------------- */

test('adresa se taie la primele trei numere', () => {
  /* Ajunge ca să vezi că zece încercări vin din același loc, nu ajunge ca
     să spui cine e omul. */
  assert.equal(adresaTrunchiata('93.119.153.225'), '93.119.153.0');
  assert.equal(adresaTrunchiata('::ffff:93.119.153.225'), '93.119.153.0');
  assert.equal(adresaTrunchiata('8.8.8.8'), '8.8.8.0');
});

test('adresele noi (IPv6) păstrează doar începutul', () => {
  const r = adresaTrunchiata('2a02:2f0a:b10f:ffff:0:0:0:1');
  assert.equal(r, '2a02:2f0a:b10f:ffff::');
  assert.ok(!/:1$/.test(r), 'a rămas partea care identifică aparatul');
});

test('o adresă lipsă sau ciudată nu dărâmă nimic', () => {
  [null, undefined, '', 'nu-e-o-adresa', '1.2.3'].forEach(x => {
    assert.doesNotThrow(() => adresaTrunchiata(x));
  });
});

/* ---------------- nu dărâmă aplicația ---------------- */

test('scrierea e învelită: o bază căzută pierde un rând, nu comanda omului', () => {
  assert.match(SURSA, /function scrie\([\s\S]*?try \{/,
    'scrierea nu mai e învelită în try');
  assert.match(SURSA, /catch \(e\) \{[\s\S]{0,300}console\.error\('jurnalul nu a putut scrie/,
    'dacă jurnalul cade, nu mai rămâne nici măcar consola');
});

test('interogarea se pregătește la prima scriere, nu la încărcare', () => {
  /* server.js cere modulele ÎNAINTE de migrații: o interogare pregătită la
     încărcare ar cădea cu „no such table" la prima pornire pe un server nou.
     Am prins-o pe pielea mea. */
  assert.match(SURSA, /let _insereaza = null;/);
  assert.match(SURSA, /function interogarea\(\)/);
  assert.ok(!/^const insereaza = db\.prepare/m.test(SURSA),
    'interogarea s-a întors la pregătirea din capul fișierului');
});

/* ---------------- nu crește la nesfârșit ---------------- */

test('sunt două limite, nu una', () => {
  /* Una singură nu ajunge: 90 de zile de liniște încap lejer, dar 90 de
     zile de buclă de erori umplu discul de 1 GB — adică exact paguba pe
     care jurnalul trebuia s-o prevină. */
  assert.match(SURSA, /created_at < datetime\('now', \?\)/, 'nu mai taie după vârstă');
  assert.match(SURSA, /ORDER BY id DESC LIMIT \?/, 'nu mai taie după număr');
});

test('curățenia nu se face la fiecare scriere', () => {
  /* Ar însemna două interogări în plus pe fiecare eroare, tocmai când
     aplicația are deja necazuri. */
  assert.match(SURSA, /deLaUltimaCuratenie >= \d+/);
});

/* ---------------- legătura cu aplicația ---------------- */

test('erorile chiar ajung în jurnal, nu doar în consolă', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /jurnal\.scrie\(status >= 500 \? 'eroare' : 'atentie', 'http'/);
});

test('autentificarea respinsă se scrie, dar fără parolă', () => {
  const auth = fs.readFileSync(path.join(__dirname, '..', 'src', 'auth.js'), 'utf8');
  const chemare = auth.match(/jurnal\.atentie\('cont', 'autentificare respinsa'[\s\S]{0,200}?\}\);/);
  assert.ok(chemare, 'nu se mai scrie autentificarea respinsă');
  assert.match(chemare[0], /email/, 'nu se vede ce adresă s-a încercat');
  assert.ok(!/parsed\.data\.password/.test(chemare[0]), 'parola ajunge în jurnal');
});

test('ștergerile se scriu ÎNAINTE de ștergere', () => {
  /* După, nu mai ai de unde afla ce anume a plecat. */
  const corps = fs.readFileSync(path.join(__dirname, '..', 'src', 'corps.js'), 'utf8');
  const orders = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders.js'), 'utf8');
  assert.ok(corps.indexOf("jurnal.fapta('corp', 'corp sters'") <
            corps.indexOf("DELETE FROM corps WHERE id"), 'corpul se scrie după ștergere');
  assert.ok(orders.indexOf("jurnal.fapta('comanda', 'comanda stearsa'") <
            orders.indexOf("DELETE FROM orders WHERE id"), 'comanda se scrie după ștergere');
});

test('cele trei feluri de rânduri au text în toate cele 30 de limbi', () => {
  const LOCALES = path.join(__dirname, '..', 'locales');
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const d = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    NIVELE.forEach(n => {
      const cheie = 'nivel' + n.charAt(0).toUpperCase() + n.slice(1);
      assert.ok(d.jurnal && d.jurnal[cheie], `${f} n-are jurnal.${cheie}`);
    });
  });
});
