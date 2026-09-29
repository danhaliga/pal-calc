'use strict';
/* Nișa: golul dintre zonele cu uși.

   O coloană de cuptor are ușă jos, GOL la mijloc pentru aparat, ușă sus.
   Până acum `hUsi` punea uși numai de jos în sus — golul de la mijloc nu se
   putea scrie în niciun fel. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalI18n = require('../shared/i18n');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

function coloana(extra) {
  return Object.assign({}, PalModels.paramsFor('coloana-camara', T),
    { W: 600, H: 2000, D: 600, soclu: 80, nUsi: 1, nPol: 3 }, extra || {});
}
/* Ușile, ca fâșii pe înălțime, de jos în sus. */
function fasii(rez) {
  const out = [];
  rez.P.filter(p => p.cheie === 'usa').forEach(p => p.boxes.forEach(b => {
    out.push({ jos: Math.round(b.y), sus: Math.round(b.y + b.sy) });
  }));
  return out.sort((a, b) => a.jos - b.jos);
}
function polite(rez) {
  const p = rez.P.find(x => x.cheie === 'polita');
  return p ? p.boxes.map(b => b.y + b.sy / 2).sort((a, b) => a - b) : [];
}

/* ---------------- fără nișă nu se schimbă nimic ---------------- */

test('un corp fără nișă iese exact ca înainte', () => {
  /* Toate corpurile de până azi n-au nișă. Dacă socoteala li se mișcă, ce
     s-a tăiat după ele nu mai e bun. */
  const a = PalCalc.calc(coloana({ nUsi: 2, nPol: 5 }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const b = PalCalc.calc(coloana({ nUsi: 2, nPol: 5, hNisa: '' }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(b, a);
});

test('valoarea implicită e goală', () => {
  assert.equal(PalCalc.defaults().hNisa, '');
});

test('ușile parțiale de jos merg mai departe ca înainte', () => {
  /* Biblioteca cu uși doar jos a fost primul lucru care a cerut `hUsi`.
     Nișa n-are voie să i-o strice. */
  const r = PalCalc.calc(coloana({ hUsi: 700, nPol: 3 }), T);
  const f = fasii(r);
  assert.equal(f.length, 1, 'a apărut o a doua ușă fără să ceară nimeni nișă');
  assert.equal(f[0].sus - f[0].jos, 700);
});

/* ---------------- coloana de cuptor ---------------- */

test('ușă jos, gol la mijloc, ușă sus', () => {
  const r = PalCalc.calc(coloana({ hUsi: 700, hNisa: 600 }), T);
  const f = fasii(r);
  assert.equal(f.length, 2, 'nu ies două zone de uși');
  assert.equal(f[0].sus - f[0].jos, 700, 'ușa de jos n-are înălțimea cerută');
  assert.equal(f[1].jos - f[0].sus, 600, 'golul dintre uși nu e cât nișa cerută');
  assert.ok(f[1].sus - f[1].jos > 100, 'ușa de sus e prea mică');
  assert.deepEqual(r.warn, []);
});

test('nicio poliță nu stă în nișă', () => {
  /* O poliță la mijlocul cuptorului nu e o scăpare de desen: e o piesă
     tăiată degeaba și un corp care nu se poate monta. */
  const r = PalCalc.calc(coloana({ hUsi: 700, hNisa: 600, nPol: 6 }), T);
  const f = fasii(r);
  const jos = f[0].sus, sus = f[1].jos;
  polite(r).forEach(y => {
    assert.ok(y <= jos + 1 || y >= sus - 1,
      'o poliță a căzut în nișă, la ' + Math.round(y) + ' (nișa e ' + jos + '–' + sus + ')');
  });
});

test('nișa are polițe care o mărginesc, chiar dacă omul n-a cerut', () => {
  /* Pe cea de jos stă aparatul, de cea de sus se prinde corpul de deasupra.
     Nu sunt de pus lucruri pe ele, sunt de ținut corpul. */
  const r = PalCalc.calc(coloana({ hUsi: 700, hNisa: 600, nPol: 0 }), T);
  assert.ok(polite(r).length >= 2, 'nișa a rămas fără polițele care o țin');
  assert.ok(r.avertismente.some(a => a.cheie === 'politeFixeInPlus'),
    'a primit mai multe polițe decât a cerut, fără să i se spună');
});

/* ---------------- coloana de frigider ---------------- */

test('fără ușă jos, golul începe de la fundul corpului', () => {
  /* Frigiderul stă direct pe fund; deasupra lui se închide cu o ușă. */
  const r = PalCalc.calc(coloana({ H: 2200, hNisa: 1780, nPol: 2 }), T);
  const f = fasii(r);
  assert.equal(f.length, 1, 'a apărut o ușă și dedesubt');
  assert.ok(f[0].jos > 1700, 'ușa nu stă deasupra golului');
  assert.deepEqual(r.warn, []);
});

/* ---------------- ce nu încape ---------------- */

test('o nișă prea mare se spune, și se spune cât încape', () => {
  const r = PalCalc.calc(coloana({ hUsi: 700, hNisa: 1500 }), T);
  const a = r.avertismente.find(x => x.cheie === 'nisaPreaMare');
  assert.ok(a, 'nișa prea mare a trecut fără o vorbă');
  assert.ok(a.args && a.args.incape, 'nu spune cât ar încăpea');
  /* Și nu se face: mai bine un corp fără nișă decât unul cu ușa de sus de
     doi milimetri. */
  assert.equal(fasii(r).length, 1);
});

test('o nișă cerută pe un corp fără uși nu face nimic', () => {
  /* Fără uși corpul e deschis oricum — nișa n-ar avea între ce să stea. */
  const r = PalCalc.calc(coloana({ nUsi: 0, hNisa: 600 }), T);
  assert.equal(fasii(r).length, 0);
});

test('nișa nu poate fi negativă sau absurdă', () => {
  const schema = PalCalc.schema && PalCalc.schema();
  if (!schema) return;
  assert.equal(schema.parse(coloana({ hNisa: -100 })).hNisa, '');
  assert.equal(schema.parse(coloana({ hNisa: 'aiurea' })).hNisa, '');
  assert.equal(schema.parse(coloana({ hNisa: 600 })).hNisa, 600);
});

/* ---------------- editorul și modelele ---------------- */

test('nișa are casetă în editor și ajunge la calcul', () => {
  assert.match(citeste('views', 'corps', 'edit.ejs'), /id="hNisa"/);
  const app = citeste('public', 'app.js');
  assert.match(app, /'hUsi','hNisa'/, 'editorul nu trimite nișa la calcul');
  assert.match(app, /ZERO_E_GOL = \['hUsi', 'hNisa'/, 'zero se arată ca zero, nu ca gol');
});

test('coloanele din catalog chiar au gol la mijloc', () => {
  const cuptor = PalCalc.calc(PalModels.paramsFor('coloana-cuptor', T), T);
  const f = fasii(cuptor);
  assert.equal(f.length, 2, 'coloana de cuptor n-are două zone de uși');
  assert.ok(f[1].jos - f[0].sus >= 590,
    'golul pentru cuptor e mai mic decât nișa unui cuptor obișnuit de 60');
  assert.deepEqual(cuptor.warn, []);

  const frigider = PalCalc.calc(PalModels.paramsFor('coloana-frigider', T), T);
  assert.equal(fasii(frigider).length, 1);
  assert.deepEqual(frigider.warn, []);
});

test('nișa are nume în toate cele treizeci de limbi', () => {
  const chei = ['editor.nisa', 'editor.nisaFara',
                'avert.nisaPreaMare', 'avert.politeFixeInPlus', 'avert.politeNuIncap'];
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');

  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipsește ' + k);
      assert.equal(param(v), param(ia(ro, k)), l.cod + ': parametri schimbați la ' + k);
    });
  });
});
