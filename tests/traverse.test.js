'use strict';
/* Traversele: corpul de bază nu are capac întreg.

   Sub blatul de bucătărie un panou pe toată adâncimea e PAL aruncat — îl
   acoperă blatul oricum. Se pun două traverse, una în față și una în spate.
   Așa fac toate fabricile. */

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
const corp = (extra) => Object.assign({}, PalModels.paramsFor('baza-2usi', T), extra || {});
const bucata = (r, cheie) => r.P.filter(p => p.cheie === cheie);

/* ---------------- fără traverse nu se schimbă nimic ---------------- */

test('un corp cu blat întreg iese exact ca înainte', () => {
  const a = PalCalc.calc(corp(), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const b = PalCalc.calc(corp({ traverse: 0 }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(b, a);
  assert.equal(PalCalc.defaults().traverse, 0, 'blatul întreg nu mai e felul obișnuit');
});

/* ---------------- ce se schimbă ---------------- */

test('traversele iau locul blatului, două bucăți', () => {
  const r = PalCalc.calc(corp({ traverse: 60 }), T);
  assert.equal(bucata(r, 'blat').length, 0, 'a rămas și blatul');
  const tr = bucata(r, 'traversa')[0];
  assert.ok(tr, 'lipsesc traversele');
  assert.equal(tr.buc, 2, 'una singură nu ține corpul în echer');
  assert.equal(tr.TL, bucata(r, 'fund')[0].TL, 'traversa nu e cât fundul — nu intră între laterale');
});

test('traversele economisesc PAL, și de-aia există', () => {
  /* Un corp de 800 cu blat întreg are 764×556 sus. Cu traverse de 60 are
     2 × 764×60. Dacă raportul ăsta se strică, s-a stricat rostul lor. */
  const susCuBlat = PalCalc.calc(corp(), T).P
    .filter(p => p.cheie === 'blat').reduce((s, p) => s + p.buc * p.TL * p.Tl, 0);
  const susCuTraverse = PalCalc.calc(corp({ traverse: 60 }), T).P
    .filter(p => p.cheie === 'traversa').reduce((s, p) => s + p.buc * p.TL * p.Tl, 0);
  assert.ok(susCuTraverse < susCuBlat * 0.45,
    'traversele nu mai economisesc material: ' + Math.round(susCuTraverse) +
    ' față de ' + Math.round(susCuBlat));
});

test('interiorul rămâne cât era: traversele stau tot sus, groase cât placa', () => {
  const cu = PalCalc.calc(corp({ traverse: 60 }), T);
  const fara = PalCalc.calc(corp(), T);
  assert.equal(cu.Hint, fara.Hint);
  ['usa', 'polita', 'fund'].forEach(cheie => {
    const a = bucata(cu, cheie)[0], b = bucata(fara, cheie)[0];
    assert.deepEqual([a.buc, a.TL, a.Tl], [b.buc, b.TL, b.Tl], cheie + ' s-a mișcat');
  });
});

/* ---------------- limitele ---------------- */

test('traversa se face între 40 și 100, standard 60', () => {
  assert.equal(PalCalc.TRAVERSA_MIN, 40);
  assert.equal(PalCalc.TRAVERSA_MAX, 100);
  assert.equal(PalCalc.TRAVERSA_STANDARD, 60);
});

test('ce iese din limite se aduce înapoi, și se spune', () => {
  /* Sub 40 nu mai ține colțul în echer și se îndoaie când strângi blatul;
     peste 100 tai PAL degeaba. Se aduce în limite — dar omul a scris un
     număr și are dreptul să afle că s-a tăiat altul. */
  [[20, 40], [150, 100]].forEach(([cerut, asteptat]) => {
    const r = PalCalc.calc(corp({ traverse: cerut }), T);
    const tr = bucata(r, 'traversa')[0];
    assert.ok(tr, cerut + ': n-au ieșit traverse deloc');
    /* cota de tăiere e cea finită minus cantul */
    assert.ok(Math.abs(tr.Tl - (asteptat - 1.5)) < 0.01,
      cerut + ' a ieșit ' + tr.Tl + ', așteptam pe la ' + (asteptat - 1.5));
    assert.ok(r.avertismente.some(a => a.cheie === 'traverseInAfara'),
      cerut + ' a fost schimbat fără să spună nimeni');
  });
});

test('în limite nu se spune nimic', () => {
  [40, 60, 100].forEach(v => {
    const r = PalCalc.calc(corp({ traverse: v }), T);
    assert.ok(!r.avertismente.some(a => a.cheie === 'traverseInAfara'),
      v + ' e în limite și totuși se plânge');
  });
});

test('două traverse care se ating nu mai sunt traverse', () => {
  /* Pe un corp puțin adânc, două de 100 se ating — ar fi un blat prost
     tăiat. Atunci rămâne blatul întreg. */
  const r = PalCalc.calc(corp({ D: 170, traverse: 100 }), T);
  assert.equal(bucata(r, 'traversa').length, 0);
  assert.ok(r.avertismente.some(a => a.cheie === 'traversePreaLate'));
});

test('traversele se pun numai unde pot sta', () => {
  /* La construcția „peste" lateralele stau între blat și fund; niște
     traverse acolo n-ar avea de ce se prinde. */
  const r = PalCalc.calc(corp({ traverse: 60, constr: 'peste' }), T);
  assert.equal(bucata(r, 'traversa').length, 0);
  assert.equal(bucata(r, 'blat').length, 1);
  assert.ok(r.avertismente.some(a => a.cheie === 'traverseNuMerg'));
});

test('schema nu lasă numere absurde', () => {
  const schema = PalCalc.schema && PalCalc.schema();
  if (!schema) return;
  assert.equal(schema.parse(corp({ traverse: -10 })).traverse, 0);
  assert.equal(schema.parse(corp({ traverse: 'aiurea' })).traverse, 0);
  assert.equal(schema.parse(corp({ traverse: 5000 })).traverse, 0);
  assert.equal(schema.parse(corp({ traverse: 60 })).traverse, 60);
});

/* ---------------- editorul, cardul, catalogul ---------------- */

test('traversele se pot cere din editor', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /id="traverse"/);
  assert.match(vedere, /min="0" max="100"/);
  const app = citeste('public', 'app.js');
  assert.match(app, /var fields = \[[^\]]*'traverse'/, 'editorul nu trimite traversele la calcul');
  assert.deepEqual(require('../shared/models').campuriGrup('traverse'), ['traverse'], 'nu se pot ține minte ca setare');
  assert.match(app, /id: 'traverse',\s+camp: window\.PalModels\.campuriGrup\('traverse'\)/);
});

test('cardul spune dacă sunt traverse', () => {
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  PalI18n.inregistreaza('ro', ro);
  const t = PalI18n.creeaza('ro');
  assert.match(PalModels.rezumat(corp({ traverse: 60 }), t), /60/);
  assert.ok(!/traver/i.test(PalModels.rezumat(corp(), t)),
    'scrie de traverse și la un corp cu blat întreg');
});

test('corpul îngust pentru cargo e în catalog și iese curat', () => {
  const p = PalModels.paramsFor('baza-jolly', T);
  assert.ok(p, 'lipsește modelul');
  assert.equal(p.nPol, 0, 'cargoul umple corpul: n-are ce căuta o poliță');
  assert.deepEqual(PalCalc.calc(p, T).warn, []);
});

test('traversele au nume în toate cele treizeci de limbi', () => {
  const chei = ['piesa.traversa', 'nota.traverseSusInLocDeBlat', 'editor.traverse',
                'editor.traverseFara', 'avert.traverseNuMerg', 'avert.traversePreaLate',
                'avert.traverseInAfara', 'setari.grupTraverse', 'rezumat.cuTraverse'];
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

test('catalogul n-a fost șters de scriptul de traduceri', () => {
  /* S-a întâmplat chiar azi: scriptul care amestecă pe UN SINGUR NIVEL a
     înlocuit spațiul „modele" cu cele două intrări noi — adică a șters tot
     catalogul din toate cele treizeci de limbi, tăcut. Testul ăsta cade
     dacă se mai întâmplă o dată. */
  const toate = PalModels.modele(T).map(m => m.id);
  assert.ok(toate.length >= 40, 'catalogul s-a subțiat: ' + toate.length + ' modele');
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    const m = (c.modele && c.modele.m) || {};
    const cat = (c.modele && c.modele.cat) || {};
    assert.ok(Object.keys(m).length >= toate.length,
      l.cod + ': are doar ' + Object.keys(m).length + ' modele din ' + toate.length);
    assert.ok(Object.keys(cat).length >= 7, l.cod + ': i-au dispărut categorii');
  });
});
