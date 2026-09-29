'use strict';
/* Ce a găsit auditul din 29 septembrie, noaptea — fiecare lucru cu testul
   lui, ca să nu se întoarcă. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalFisa = require('../shared/fisa-piesa');
const PalI18n = require('../shared/i18n');
const { raport, lungimePlinta } = require('../shared/raport');

const T = k => k;
const citeste = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const subScara = (x, dr, st, extra) => Object.assign(PalCalc.defaults(T),
  { tip: 'atipic', contur: PalCalc.conturSubScara(x, dr, st), nUsi: 0, t: 18, jp: 1 }, extra || {});

/* ---------- 1. piesele dinăuntru intră în carcasă ---------- */

test('polița corpului de sub scară intră între laturi: cât fața interioară a fundului, minus jocul', () => {
  /* Laturile stau ÎNĂUNTRUL conturului (cota lor e pe muchia exterioară).
     Se socotea cu o jumătate de grosime: polița ieșea de 982 într-un gol de
     964 — nu intra. */
  const p = subScara(1000, 600, 1200, { nPol: 1 });
  const pol = PalCalc.calc(p, T).P.find(x => x.cheie === 'polita');
  const fund = PalFisa.fise(p, PalI18n.creeaza('ro')).find(f => f.cheie === 'panouLatura');   /* primul e cel de jos */
  const interior = +/(\d+(?:\.\d+)?) mm/.exec(fund.randuri[1])[1];
  assert.equal(interior, 964);
  assert.equal(pol.L, interior - 1);
});

test('montantul se oprește sub fața de jos a pantei, nu în ea', () => {
  const p = subScara(1000, 600, 1200, { nDsp: 1 });
  const r = PalCalc.calc(p, T);
  const m = r.P.find(x => x.cheie === 'montantAtipic').boxes[0];
  /* Panta: de la 1200 (stânga) la 600 (dreapta). Fața ei de jos e cu
     t / cos(pantă) mai jos, pe verticală. */
  const alfa = Math.atan2(600, 1000);
  const susLa = x => 1200 - 600 * x / 1000 - 18 / Math.cos(alfa);
  m.polyFata.forEach(([x, y]) => {
    if (y > m.y + 1) assert.ok(y <= susLa(x) + 0.05, `montantul intră în pantă la x=${x}: ${y} > ${susLa(x)}`);
  });
  assert.ok(Math.abs(m.y - 18) < 0.01, 'montantul nu pornește de pe fața de sus a fundului');
});

/* ---------- 2. colțul intrând nu dă unghiuri negative ---------- */

test('la un colț intrând fișa nu scrie unghiuri sau cote negative', () => {
  const L = PalCalc.conturDinPuncte([[0, 0], [1000, 0], [1000, 500], [500, 500], [500, 1000], [0, 1000]]);
  PalFisa.fise(Object.assign(PalCalc.defaults(T), { tip: 'atipic', contur: L, nUsi: 0 }), PalI18n.creeaza('ro'))
    .forEach(f => {
      (f.randuri || []).forEach(r => assert.ok(!/-\d/.test(JSON.stringify(r)), 'minus pe fișă: ' + JSON.stringify(r)));
    });
});

/* ---------- 3. împărțirea sub scară: nici prea mici, nici prea mari ---------- */

test('bucățile de sub scară se verifică cu aceeași regulă pe server și în editor', () => {
  assert.equal(PalCalc.subScaraProblema(PalCalc.subScaraInBucati(4000, 500, 3500, 1)), 'subScaraPreaMare');
  assert.equal(PalCalc.subScaraProblema(PalCalc.subScaraInBucati(300, 500, 600, 10)), 'subScaraPreaIngust');
  assert.equal(PalCalc.subScaraProblema(PalCalc.subScaraInBucati(4000, 500, 2200, 2)), null);
  assert.match(citeste('src', 'orders.js'), /PalCalc\.subScaraProblema\(bucati\)/);
  assert.match(citeste('public', 'app.js'), /PalCalc\.subScaraProblema\(/);
});

test('dintr-o singură bucată corpul își păstrează numele', () => {
  assert.match(citeste('src', 'orders.js'), /nume: n > 1 \? numeDeBaza \+ ' \(1\/' \+ n \+ '\)' : numeDeBaza/);
});

/* ---------- 4. texte ---------- */

test('mișcarea de credit a corpurilor de sub scară are text în toate limbile', () => {
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    assert.match((c.corp || {}).subScara || '', /\{nume\}/, l.cod + ': lipsește corp.subScara');
    ['subScaraPreaMare', 'subScaraPreaIngust'].forEach(k => {
      assert.ok(c.eroare[k] && c.editor[k], l.cod + ': lipsește ' + k);
    });
    assert.ok(c.fisa.rCapatInterior && c.fero.art.sistemGlisant, l.cod + ': texte lipsă');
  });
});

/* ---------- 5. soclu cerut dar nepus → rămâne pe picioare ---------- */

test('un corp care n-a primit soclul cerut rămâne pe picioare, cu plintă', () => {
  const p = Object.assign(PalModels.paramsFor('baza-2usi', T), { constr: 'peste', soclu: 80 });
  const r = PalCalc.calc(p, T);
  assert.equal(+r.soclu || 0, 0);
  assert.equal(lungimePlinta(p, r), 800);
});

/* ---------- ușile glisante n-au balamale ---------- */

test('ușile glisante primesc sistemul de glisare, nu balamale', () => {
  const mat = { id: 1, nume: 'P', rol: 'corp', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 };
  const f = raport({ id: 1, name: 'c', formate: ['intreaga'], materiale: [mat], feronerie: null },
    [{ id: 1, name: 'x', poz: 1, params: PalModels.paramsFor('dulap-glisant', T),
       materiale: { corp: mat, front: mat, sertar: mat } }], { effortMs: 0, t: T }).feronerie;
  assert.equal(f.filter(x => /balama/i.test(x.nume)).length, 0);
  assert.equal(f.find(x => x.nume === 'fero.art.sistemGlisant').qty, 1);
});
