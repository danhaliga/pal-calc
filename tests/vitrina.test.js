'use strict';
/* Vitrina: uși cu ramă de aluminiu și sticlă, cumpărate gata la cotă.

   Din PAL se taie doar corpul. Ușile ies din lista de debitare, dar nu se
   pierd: intră la „de comandat", cu balamalele lor — care nu sunt cele de
   PAL — și cu mânerele. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalI18n = require('../shared/i18n');
const { raport } = require('../shared/raport');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');
const mat = { id: 1, nume: 'PAL', rol: 'corp', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 };
const comanda = { id: 1, name: 'C', formate: ['intreaga'], materiale: [mat], feronerie: null };
const corp = (params, id) => ({ id: id || 1, name: 'V', poz: id || 1, params,
                                materiale: { corp: mat, front: mat, sertar: mat } });

test('ușile de sticlă ies din lista de debitare, cu cota lor la „de comandat"', () => {
  const p = PalModels.paramsFor('sus-vitrina', T);
  const r = PalCalc.calc(p, T);
  assert.deepEqual(r.warn, []);
  assert.equal(r.P.filter(x => x.cheie === 'usa').length, 0, 'o ușă de sticlă a rămas de tăiat din PAL');

  /* Aceeași cotă pe care ar fi avut-o ușa de PAL: rama se face la ea. */
  const dinPal = PalCalc.calc(Object.assign({}, p, { usiSticla: 0 }), T).P.find(x => x.cheie === 'usa');
  assert.deepEqual(r.deComandat, [{ fel: 'usaRamaAlu', cheie: 'usa', H: dinPal.L, L: dinPal.l, buc: dinPal.buc }]);
  assert.equal(r.sticla3d.length, dinPal.boxes.length, 'ușile nu se mai văd în 3D');
});

test('carcasa și polițele rămân exact ca la dulapul cu uși de PAL', () => {
  const p = PalModels.paramsFor('vitrina', T);
  const cu = PalCalc.calc(p, T).P.map(x => [x.cheie, x.buc, x.TL, x.Tl]);
  const fara = PalCalc.calc(Object.assign({}, p, { usiSticla: 0 }), T).P
    .filter(x => x.cheie !== 'usa').map(x => [x.cheie, x.buc, x.TL, x.Tl]);
  assert.deepEqual(cu, fara);
});

test('fronturile de sertar rămân din PAL; doar ușile sunt de sticlă', () => {
  const r = PalCalc.calc(Object.assign(PalModels.paramsFor('baza-sertar-usa', T), { usiSticla: 1 }), T);
  assert.equal(r.P.filter(x => x.cheie === 'frontSertar').length, 1);
  assert.equal(r.deComandat.length, 1);
});

test('la colțul în L ambele uși de braț sunt de comandat', () => {
  const r = PalCalc.calc(Object.assign(PalModels.paramsFor('colt-sus-L', T), { usiSticla: 1 }), T);
  assert.deepEqual(r.deComandat.map(d => d.cheie), ['usaBrat1', 'usaBrat2']);
});

test('„fără fronturi" câștigă: nu se comandă nicio ușă de sticlă', () => {
  const r = PalCalc.calc(Object.assign(PalModels.paramsFor('sus-vitrina', T), { faraFront: 1 }), T);
  assert.deepEqual(r.deComandat, []);
});

test('în lista comenzii: ușile de comandat, balamalele de ramă și mânerele', () => {
  const r = raport(comanda, [corp(PalModels.paramsFor('sus-vitrina', T))], { effortMs: 0, t: T });
  const f = nume => r.feronerie.filter(x => x.nume.indexOf(nume) === 0);
  assert.equal(f('fero.art.usaRamaAlu')[0].qty, 2);
  assert.equal(f('fero.art.balamaRamaAlu')[0].qty, 2 * PalCalc.balamale(717));
  assert.equal(f('fero.balama').length + f('fero.art.balamaCu').length, 0,
    'balamale de PAL pentru uși care nu sunt de PAL');
  assert.equal(f('fero.art.maner')[0].qty, 2, 'ușile de sticlă au rămas fără mâner');
});

test('se alege din editor, se vede în 3D și pe card', () => {
  assert.match(citeste('views', 'corps', 'edit.ejs'), /id="usiSticla"/);
  const app = citeste('public', 'app.js');
  assert.match(app, /var fields = \[[^\]]*'usiSticla'/);
  assert.match(app, /res\.sticla3d/);
  assert.match(app, /res\.deComandat/);
  assert.match(PalModels.sketch(PalModels.paramsFor('sus-vitrina', T)), /sk-front sticla/);
  assert.match(PalModels.rezumat(PalModels.paramsFor('vitrina', T), T), /rezumat\.usiSticla/);
});

test('textele vitrinei există în toate limbile, cu aceiași parametri', () => {
  const chei = ['editor.usiSticla', 'editor.usiSticlaNu', 'editor.usiSticlaDa',
    'editor.deComandat.usaRamaAlu', 'fero.art.usaRamaAlu', 'fero.art.obsUsaRamaAlu',
    'fero.art.balamaRamaAlu', 'rezumat.usiSticla',
    'modele.m.sus-vitrina.nume', 'modele.m.sus-vitrina.descriere', 'modele.m.sus-vitrina.corpNume',
    'modele.m.vitrina.nume', 'modele.m.vitrina.descriere', 'modele.m.vitrina.corpNume'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipsește ' + k);
      assert.equal(param(v), param(ia(ro, k)), l.cod + ': parametri schimbați la ' + k);
    });
  });
});
