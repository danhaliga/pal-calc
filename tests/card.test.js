'use strict';
/* Cardul din catalog trebuie să fie corpul care iese.

   Dan: „desenele de pe /corps/new nu seamănă cu cele din pagina când intri
   pe corp". Două pricini: schița era un desen separat, scris de mână (nu
   știa de nișă, montanți, uși doar jos, sticlă), și nu știa de setările
   ținute minte ale omului (soclul, materialul...). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalModels = require('../shared/models');
const PalCalc = require('../shared/calc');
const T = k => k;
const citeste = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('schița se face din piesele calculate: nișa, montanții, ușile jos', () => {
  const nr = (id, cls) => (PalModels.sketch(PalModels.paramsFor(id, T)).match(new RegExp('class="' + cls + '"', 'g')) || []).length;
  assert.equal(nr('coloana-cuptor', 'sk-front'), 2, 'coloana de cuptor fără gol între uși');
  assert.equal(nr('etajera-cuburi', 'sk-corp'), 1 + 3, 'etajera fără montanți');
  const pol = PalCalc.calc(PalModels.paramsFor('biblioteca-usi-jos', T), T).P.find(p => p.cheie === 'polita');
  assert.equal(nr('biblioteca-usi-jos', 'sk-polita'), pol.buc);
});

test('cardurile se redesenează cu setările omului, cu regula editorului', () => {
  const v = citeste('views', 'corps', 'new.ejs');
  assert.match(v, /id="modele-data"/);
  assert.match(v, /data-model="<%= m\.id %>"/);
  assert.match(v, /\/shared\/models\.js/);
  const js = citeste('public', 'models-pick.js');
  assert.match(js, /PalModels\.aplicaSetari\(/, 'cardul și-ar face altă regulă decât editorul');
  assert.match(js, /'pal-calc\.setari-corp'/);
  assert.match(citeste('public', 'app.js'), /var CHEIE_SETARI = 'pal-calc\.setari-corp'/);
  ['src/corps.js', 'src/orders.js'].forEach(f => {
    assert.match(citeste(f), /pePodea: PalModels\.staPePodea\(m\.id\), cheiModel: PalModels\.cheileModelului\(m\.id\)/, f);
  });
});

test('soclul din setări se vede pe card și ridică cota, ca în editor', () => {
  const p = PalModels.paramsFor('baza-2usi', T);
  PalModels.aplicaSetari(p, { grupe: { soclu: true }, val: { soclu: 80 } },
    { cheiModel: PalModels.cheileModelului('baza-2usi'), pePodea: PalModels.staPePodea('baza-2usi') });
  assert.equal(p.H, 800);
  assert.match(PalModels.sketch(p), /sk-soclu/);
});
