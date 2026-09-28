'use strict';
/* Unitatea de măsură.

   Trei lucruri se păzesc aici, fiindcă fiecare, stricat, e o piesă tăiată
   greșit:

     1. Ce se scrie pe ecran se poate citi înapoi, neschimbat.
     2. Baza de date rămâne în milimetri, oricât de mult ar arăta țoli.
     3. Cota de debitare cade pe o fracție pe care omul o poate măsura.
*/

const test = require('node:test');
const assert = require('node:assert/strict');

const U = require('../shared/unitati');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');

const T = k => k;
const IN = t => t * 25.4;

/* ---------------- scrisul ---------------- */

test('în țoli se scriu fracții, nu zecimale', () => {
  /* Un atelier american scrie 22½", nu 22.5". Dacă vede zecimale, știe din
     prima că unealta e făcută de cineva care nu lucrează așa. */
  assert.equal(U.scrie(IN(22.5), 'inch'), '22 1/2');
  assert.equal(U.scrie(IN(24), 'inch'), '24');
  assert.equal(U.scrie(IN(0.75), 'inch'), '3/4');
  assert.equal(U.scrie(IN(34.5), 'inch'), '34 1/2');
  assert.equal(U.scrie(IN(23.6875), 'inch'), '23 11/16');
  assert.ok(U.scrie(IN(22.5), 'inch').indexOf('.') === -1, 'a apărut o zecimală');
});

test('fracția se simplifică', () => {
  /* „22 8/16" e adevărat, dar nu-l scrie nimeni așa. */
  assert.equal(U.scrie(IN(22 + 8 / 16), 'inch'), '22 1/2');
  assert.equal(U.scrie(IN(22 + 4 / 16), 'inch'), '22 1/4');
  assert.equal(U.scrie(IN(22 + 12 / 16), 'inch'), '22 3/4');
  assert.equal(U.scrie(IN(22 + 2 / 16), 'inch'), '22 1/8');
  assert.equal(U.scrie(IN(22 + 3 / 16), 'inch'), '22 3/16');
});

test('în milimetri rămâne cum a fost, fără zerouri de prisos', () => {
  assert.equal(U.scrie(571.5, 'mm'), '571.5');
  assert.equal(U.scrie(560, 'mm'), '560');
  assert.equal(U.scrie(560, ''), '560', 'unitatea goală înseamnă milimetri');
  assert.equal(U.scrie(560, 'altceva'), '560', 'o unitate necunoscută nu strică pagina');
});

test('semnul unității se lipește cum trebuie', () => {
  assert.equal(U.scrieCuSemn(571.5, 'mm'), '571.5 mm');
  assert.equal(U.scrieCuSemn(IN(22.5), 'inch'), '22 1/2"');
});

/* ---------------- cititul ---------------- */

test('se primesc toate felurile în care se scrie o cotă în atelier', () => {
  const asteptat = IN(22.5);
  ['22 1/2', '22-1/2', '22 1/2"', '22½', '22 ½', '22.5', ' 22 1/2 ']
    .forEach(scris => {
      assert.ok(Math.abs(U.citeste(scris, 'inch') - asteptat) < 1e-9,
        `„${scris}" n-a fost citit ca 22½`);
    });
});

test('fracția singură, și cota întreagă', () => {
  assert.ok(Math.abs(U.citeste('1/2', 'inch') - IN(0.5)) < 1e-9);
  assert.ok(Math.abs(U.citeste('3/4', 'inch') - IN(0.75)) < 1e-9);
  assert.ok(Math.abs(U.citeste('24', 'inch') - IN(24)) < 1e-9);
  assert.ok(Math.abs(U.citeste('-22 1/2', 'inch') + IN(22.5)) < 1e-9);
});

test('ce nu se poate citi întoarce null, nu zero', () => {
  /* Zero e o cotă. „Nu înțeleg" nu e, și dacă s-ar întoarce zero, corpul
     ar sări la zero între două apăsări de tastă. */
  ['', '   ', 'aiurea', '22 1/', '1/0', '22 1/2 3/4', 'x/y', '--5']
    .forEach(rau => assert.equal(U.citeste(rau, 'inch'), null, `„${rau}" a trecut`));
  assert.equal(U.citeste(null, 'inch'), null);
  assert.equal(U.citeste(undefined, 'mm'), null);
});

test('în milimetri se primește și virgula zecimală', () => {
  /* Jumătate de Europă o scrie așa. */
  assert.equal(U.citeste('571,5', 'mm'), 571.5);
  assert.equal(U.citeste('571.5', 'mm'), 571.5);
  assert.equal(U.citeste('560 mm', 'mm'), 560);
  assert.equal(U.citeste('aiurea', 'mm'), null);
});

test('ce se scrie se citește înapoi, neschimbat', () => {
  /* Dus-întors pe fiecare crestătură de 1/16 până la 40 de țoli. Dacă asta
     cade, o cotă se schimbă singură când omul iese din casetă. */
  for (let s = 1; s <= 16 * 40; s++) {
    const mm = s * 25.4 / 16;
    const scris = U.scrie(mm, 'inch');
    const inapoi = U.citeste(scris, 'inch');
    assert.ok(Math.abs(inapoi - mm) < 1e-9,
      `„${scris}" s-a citit ca ${inapoi} în loc de ${mm}`);
  }
});

/* ---------------- rotunjirea ---------------- */

test('o cotă se așază pe crestătura unității', () => {
  assert.equal(U.rotunjeste(601.75, 'inch'), 601.6625);
  assert.equal(U.scrie(U.rotunjeste(601.75, 'inch'), 'inch'), '23 11/16');
  assert.equal(U.rotunjeste(571.55, 'mm'), 571.6);
  assert.equal(U.rotunjeste(571.549, 'mm'), 571.5);
});

test('rotunjirea nu lasă cozi din virgula mobilă', () => {
  /* „601.6624999999999" într-o listă de debitare arată a greșeală. */
  for (let s = 1; s <= 200; s++) {
    const v = U.rotunjeste(s * 7.3, 'inch');
    assert.ok(String(v).replace('-', '').replace('.', '').length <= 12,
      `a ieșit o coadă: ${v}`);
  }
});

test('se știe dacă o cotă stă deja pe crestătură', () => {
  assert.equal(U.esteExact(IN(22.5), 'inch'), true);
  assert.equal(U.esteExact(601.75, 'inch'), false);
  assert.equal(U.esteExact(571.5, 'mm'), true);
  assert.equal(U.esteExact(571.55, 'mm'), false);
});

/* ---------------- motorul de calcul ---------------- */

function corpAmerican(extra) {
  return Object.assign({}, PalModels.paramsFor('baza-2usi', T), {
    unitate: 'inch',
    W: IN(24), H: IN(34.5), D: IN(24),
    rm: IN(1 / 16), ri: IN(1 / 8), rinc: IN(1 / 16),
    jp: IN(1 / 32), rp: IN(0.75), jg: IN(0.5),
    hFront: IN(6), hCutie: IN(4), nPol: 1
  }, extra || {});
}

test('un corp în țoli scoate numai cote pe care le poate măsura cineva', () => {
  /* Asta e tot rostul schimbării. Înainte, același corp scotea „22 37/64" —
     fiindcă motorul rotunjea la 0,1 mm, iar 1/64 de țol e 0,397 mm, adică
     rotunjirea era un sfert din cea mai fină fracție folosită de cineva.
     Cu ea în drum, cota NU PUTEA cădea pe o fracție curată. */
  const r = PalCalc.calc(corpAmerican(), T);
  assert.ok(r.P.length > 0);
  r.P.forEach(p => {
    assert.ok(U.esteExact(p.TL, 'inch'), `${p.cheie}: L de tăiere ${p.TL} nu cade pe 1/16`);
    assert.ok(U.esteExact(p.Tl, 'inch'), `${p.cheie}: l de tăiere ${p.Tl} nu cade pe 1/16`);
    assert.ok(!/\/(32|64|128)/.test(U.scrie(p.TL, 'inch')),
      `${p.cheie}: a ieșit o fracție prea fină: ${U.scrie(p.TL, 'inch')}`);
  });
});

test('fără unitate pe corp, calculul e neschimbat până la ultima zecimală', () => {
  /* Corpurile salvate înainte de ziua de azi n-au unitate. Nu au voie să se
     miște nici cu o sutime — lista lor de debitare e cea după care s-a
     tăiat deja. */
  const fara = PalModels.paramsFor('baza-2usi', T);
  delete fara.unitate;
  const cuGol = Object.assign({}, fara, { unitate: '' });
  const cuMm = Object.assign({}, fara, { unitate: 'mm' });

  const a = PalCalc.calc(fara, T).P.map(p => [p.L, p.l, p.TL, p.Tl]);
  const b = PalCalc.calc(cuGol, T).P.map(p => [p.L, p.l, p.TL, p.Tl]);
  const c = PalCalc.calc(cuMm, T).P.map(p => [p.L, p.l, p.TL, p.Tl]);

  assert.deepEqual(b, a, 'unitatea goală a schimbat cotele');
  assert.deepEqual(c, a, '„mm" a schimbat cotele față de niciuna');
  /* și chiar sunt cotele metrice de dinainte */
  assert.ok(a.some(x => x[0] === 720), 'laterala de 720 a dispărut');
});

test('unitatea se păstrează prin schema de validare', () => {
  /* Zod aruncă ce nu e în schemă. Dacă `unitate` ar cădea la validare,
     corpul s-ar întoarce pe milimetri la prima salvare, tăcut. */
  const schema = PalCalc.schema && PalCalc.schema();
  if (!schema) return;                       /* în browser nu există */
  const iesit = schema.parse(corpAmerican());
  assert.equal(iesit.unitate, 'inch');
  assert.equal(schema.parse(Object.assign(corpAmerican(), { unitate: 'coti' })).unitate, '');
});

/* ---------------- ce se arată în unitate și ce nu ---------------- */

test('grosimile de material rămân în milimetri', () => {
  /* Placa, cantul și PFL-ul se fabrică metric în toată lumea și se vând în
     milimetri — placa vândută în Statele Unite ca „¾ țoli" are 23/32, adică
     18,26 mm. „45/64" n-ar ajuta pe nimeni: nu așa scrie pe factură. */
  ['t', 'ts', 'tp', 'cg', 'cs', 'pragCant', 'rezervaCant'].forEach(k => {
    assert.ok(PalCalc.COTE_UNITATE.indexOf(k) === -1,
      `„${k}" e o grosime de material și n-ar trebui arătată în țoli`);
  });
});

test('cotele corpului se arată în unitatea atelierului', () => {
  ['W', 'H', 'D', 'rm', 'ri', 'rinc', 'rp', 'jp', 'jg', 'hFront', 'hCutie']
    .forEach(k => assert.ok(PalCalc.COTE_UNITATE.indexOf(k) !== -1,
      `„${k}" e o cotă de corp și ar trebui arătată în unitatea atelierului`));
});

test('fiecare nume din listă e un parametru adevărat', () => {
  const d = PalCalc.defaults();
  PalCalc.COTE_UNITATE.forEach(k => assert.ok(k in d, `„${k}" nu e un parametru`));
});
