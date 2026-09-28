'use strict';
/* Ce se lucrează, pe țări.

   Aici se păzește lucrul care face raportul să merite citit: că grila
   milimetrică și cea în țoli chiar se deosebesc, și că numele constantelor
   sunt cele din editor, nu altele scrise pe lângă. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const stat = require('../src/statistici');
const PalCalc = require('../shared/calc');
const PalI18n = require('../shared/i18n');

const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');
const RO = JSON.parse(citeste('locales', 'ro.json'));

const TOL = 25.4;
const T_MM = stat.TOLERANTA_MM;
const T_IN = stat.TOLERANTA_TOL;

/* ---------------- cele două grile se deosebesc ---------------- */

test('un milimetru rotund se recunoaște, un țol rotund la fel', () => {
  [800, 720, 560, 400, 1200].forEach(v =>
    assert.ok(stat.peGrila(v, 10, T_MM), `${v} ar trebui rotund în mm`));

  /* 24", 34½", 12", 30" — cotele obișnuite ale unui corp american */
  [24 * TOL, 34.5 * TOL, 12 * TOL, 30 * TOL, 15.75 * TOL].forEach(v =>
    assert.ok(stat.peGrila(v, stat.SFERT_DE_TOL, T_IN), `${v} ar trebui rotund în țoli`));
});

test('cotele metrice obișnuite NU cad pe grila în țoli, și invers', () => {
  /* Fără asta, raportul ar spune „lucrează în țoli" despre orice atelier. */
  [800, 720, 560, 900, 600].forEach(v =>
    assert.ok(!stat.peGrila(v, stat.SFERT_DE_TOL, T_IN),
      `${v} mm cade din greșeală pe grila în țoli`));

  [24 * TOL, 34.5 * TOL, 12 * TOL].forEach(v =>
    assert.ok(!stat.peGrila(v, 10, T_MM),
      `${v} (țoli rotunzi) cade din greșeală pe grila milimetrică`));
});

test('cele două grile aproape nu se ating', () => {
  /* Dacă s-ar atinge des, procentele n-ar mai spune nimic: fiecare cotă ar
     fi și una, și alta. Se numără câte cote dintr-un corp adevărat
     (100–1200 mm, din milimetru în milimetru) cad pe amândouă.

     Testul ăsta a prins o greșeală adevărată: cu toleranța de 0,05 mm pe
     care o pusesem la început, 400 și 870 treceau drept cote în țoli — iar
     400 e o lățime de corp pe care o taie toată Europa. De-aia toleranța
     în țoli e acum 0,02: o cotă gândită în țoli cade EXACT pe grilă, deci
     nu-i trebuie loc de joc. */
  let amandoua = 0;
  for (let v = 100; v <= 1200; v++) {
    if (stat.peGrila(v, 10, T_MM) && stat.peGrila(v, stat.SFERT_DE_TOL, T_IN)) amandoua++;
  }
  assert.equal(amandoua, 0,
    `${amandoua} cote întregi cad pe amândouă grilele — procentele n-ar mai deosebi nimic`);

  /* Prima atingere adevărată e la 1270 mm, adică fix 50 de țoli. Aia e o
     potrivire cinstită, nu o scăpare, și e destul de departe de cotele unui
     corp de mobilă ca să nu strice nimic. */
  assert.ok(stat.peGrila(1270, 10, T_MM) && stat.peGrila(1270, stat.SFERT_DE_TOL, T_IN));
});

test('toleranța nu e atât de largă încât orice să cadă pe orice', () => {
  /* Un sfert de țol e 6,35 mm. Cu o toleranță de 0,05 mm, o cotă la
     jumătatea drumului între două cresături trebuie respinsă. */
  assert.ok(!stat.peGrila(24 * TOL + 3, stat.SFERT_DE_TOL, T_IN));
  assert.ok(!stat.peGrila(805, 10, T_MM));
  /* Și nimic nu e „rotund" dacă nu e o cotă adevărată. */
  [0, -100, NaN, null, undefined, 'opt sute'].forEach(rau => {
    assert.ok(!stat.peGrila(rau, 10, T_MM), `„${rau}" a trecut drept cotă`);
  });
});

/* ---------------- verdictul tace când nu știe ---------------- */

test('verdictul nu se dă din prea puține cote', () => {
  assert.equal(stat.verdictulGrilei(
    { destule: false, total: 9, procentMm: 100, procentToli: 0 }), null);
});

test('verdictul nu se dă când cifrele sunt neclare', () => {
  /* Jumătate-jumătate nu e un răspuns, e o țară cu două obiceiuri sau prea
     puțini oameni. Mai bine nimic decât un răspuns inventat. */
  assert.equal(stat.verdictulGrilei(
    { destule: true, total: 200, procentMm: 50, procentToli: 45 }), null);
  /* Nici o majoritate subțire nu ajunge. */
  assert.equal(stat.verdictulGrilei(
    { destule: true, total: 200, procentMm: 65, procentToli: 55 }), null);
});

test('verdictul se dă când e limpede', () => {
  assert.equal(stat.verdictulGrilei(
    { destule: true, total: 200, procentMm: 96, procentToli: 4 }), 'mm');
  assert.equal(stat.verdictulGrilei(
    { destule: true, total: 200, procentMm: 8, procentToli: 91 }), 'inch');
});

/* ---------------- ce se numără ---------------- */

test('constantele numărate există chiar în corpuri', () => {
  /* O cheie scrisă greșit aici n-ar da eroare: coloana ar ieși goală și
     nimeni n-ar ști de ce. Măsura e ce are un corp cu adevărat. */
  const implicite = PalCalc.defaults();
  stat.CONSTANTE.forEach(k => {
    assert.ok(Object.prototype.hasOwnProperty.call(implicite, k),
      `„${k}" nu e o constantă a unui corp`);
    assert.equal(typeof implicite[k], 'number', `„${k}" nu e un număr`);
  });
  stat.COTE.forEach(k => assert.ok(typeof implicite[k] === 'number', `cota „${k}" lipsește`));
});

test('jocul de glisieră e printre constantele numărate', () => {
  /* E singura dintre ele care, greșită, nu dă o cotă urâtă, ci un sertar
     aruncat: glisierele americane cer exact ½ țol pe parte, nu 12,5 mm. */
  assert.ok(stat.CONSTANTE.indexOf('jg') !== -1);
});

test('interogările merg și pe o bază fără nimic potrivit', () => {
  /* O țară fără niciun corp nu trebuie să dea eroare, ci liste goale. */
  const r = stat.raport('ZZ');
  assert.equal(r.grila.total, 0);
  assert.equal(r.grila.verdict, null);
  assert.ok(Array.isArray(r.constante) && r.constante.length === stat.CONSTANTE.length);
  r.cote.forEach(c => assert.ok(Array.isArray(c.valori)));
  assert.ok(Array.isArray(stat.tari()));
});

test('o cotă necunoscută nu ajunge în interogare', () => {
  /* Numele cotei intră în SQL prin `json_extract`, deci trebuie să vină
     dintr-o listă scrisă de noi, nu din adresa paginii. */
  assert.throws(() => stat.coteFolosite("W') OR 1=1 --", null, 5), /necunoscut/);
  assert.throws(() => stat.coteFolosite('altceva', null, 5), /necunoscut/);
});

/* ---------------- numele vin din editor, nu se scriu altele ---------------- */

const ADMIN = citeste('src', 'admin.js');

function hartaDin(nume) {
  const bucata = ADMIN.match(new RegExp(nume + ':\\s*\\{([\\s\\S]*?)\\}'));
  assert.ok(bucata, `nu găsesc harta „${nume}" în src/admin.js`);
  const out = {};
  (bucata[1].match(/(\w+):\s*'([^']+)'/g) || []).forEach(p => {
    const [, k, v] = p.match(/(\w+):\s*'([^']+)'/);
    out[k] = v;
  });
  return out;
}

function are(catalog, cheie) {
  return cheie.split('.').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, catalog) !== undefined;
}

test('fiecare constantă numărată are un nume, și numele e unul care există', () => {
  const harta = hartaDin('numeConstanta');
  stat.CONSTANTE.forEach(k => {
    assert.ok(harta[k], `constanta „${k}" n-are nume în pagină — s-ar vedea cheia brută`);
    assert.ok(are(RO, harta[k]), `„${harta[k]}" nu e în locales/ro.json`);
  });
});

test('numele constantelor sunt cele din editor, nu un vocabular paralel', () => {
  /* Trei sute de termeni de tâmplărie scriși de noi în limbi pe care nu le
     citește nimeni din atelier ar fi și muncă degeaba, și alt cuvânt aici
     decât cel pe care-l vede omul în editor. */
  const harta = Object.assign(hartaDin('numeConstanta'), hartaDin('numeCota'));
  Object.keys(harta).forEach(k => {
    assert.ok(harta[k].startsWith('editor.'),
      `„${k}" folosește „${harta[k]}" în loc de o cheie din editor`);
  });
});

test('numele astea sunt traduse în toate cele treizeci de limbi', () => {
  const harta = Object.assign(hartaDin('numeConstanta'), hartaDin('numeCota'));
  const chei = Object.keys(harta).map(k => harta[k]);
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => assert.ok(are(c, k), `${l.cod}: lipsește „${k}"`));
  });
});

/* ---------------- cheile paginii ---------------- */

test('toate cheile din pagina de statistici există în română', () => {
  const sursa = citeste('views', 'admin', 'statistici.ejs');
  const chei = Array.from(new Set((sursa.match(/\bt\('([a-zA-Z0-9_.]+)'/g) || [])
    .map(s => s.replace(/^t\('/, '').replace(/'$/, ''))))
    .filter(k => !k.endsWith('.'));
  assert.ok(chei.length > 20, `prea puține chei găsite (${chei.length}) — s-a stricat căutarea`);
  chei.forEach(k => assert.ok(are(RO, k), `cheia „${k}" nu e în locales/ro.json`));
});

test('pagina de statistici e tradusă în toate cele treizeci de limbi', () => {
  const cerute = Object.keys(RO.stat).map(k => 'stat.' + k);
  const parametri = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    cerute.forEach(k => {
      const v = k.split('.').reduce((o, x) => (o || {})[x], c);
      assert.ok(v !== undefined && String(v).trim() !== '', `${l.cod}: lipsește „${k}"`);
      const asteptat = k.split('.').reduce((o, x) => (o || {})[x], RO);
      assert.equal(parametri(v), parametri(asteptat), `${l.cod}: parametri schimbați la „${k}"`);
    });
  });
});
