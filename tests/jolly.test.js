'use strict';
/* Corpul cu coș Jolly (cargo).

   Frontul se taie din PAL ca oricare altul, dar se prinde pe cadrul
   coșului, nu în balamale. Înainte modelul era un corp cu o ușă: ieșeau
   balamale care nu se montează, iar coșul nu apărea nicăieri. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalI18n = require('../shared/i18n');
const { raport } = require('../shared/raport');

const T = k => k;
const citeste = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const mat = { id: 1, nume: 'PAL', rol: 'corp', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 };
const lista = params => raport({ id: 1, name: 'C', formate: ['intreaga'], materiale: [mat], feronerie: null },
  [{ id: 1, name: 'J', poz: 1, params, materiale: { corp: mat, front: mat, sertar: mat } }],
  { effortMs: 0, t: T }).feronerie;

test('cele trei corpuri Jolly din catalog ies curat, cu frontul coșului', () => {
  [['baza-jolly', 300], ['baza-jolly-200', 200], ['baza-jolly-150', 150]].forEach(([id, w]) => {
    const p = PalModels.paramsFor(id, T);
    assert.equal(p.W, w);
    const r = PalCalc.calc(p, T);
    assert.deepEqual(r.warn, [], id);
    assert.equal(r.P.filter(x => x.cheie === 'usa').length, 0, id + ': a rămas „ușă"');
    const f = r.P.find(x => x.cheie === 'frontJolly');
    assert.ok(f && f.rol === 'front', id + ': frontul coșului lipsește');
    assert.equal(f.notaCheie, 'frontPeCadruJolly');
  });
});

test('frontul are aceeași cotă ca ușa pe care o înlocuiește', () => {
  const p = PalModels.paramsFor('baza-jolly', T);
  const usa = PalCalc.calc(Object.assign({}, p, { jolly: 0 }), T).P.find(x => x.cheie === 'usa');
  const f = PalCalc.calc(p, T).P.find(x => x.cheie === 'frontJolly');
  assert.deepEqual([f.buc, f.L, f.l, f.TL, f.Tl], [usa.buc, usa.L, usa.l, usa.TL, usa.Tl]);
});

test('în listă: coșul, fără balamale, cu mâner', () => {
  const f = lista(PalModels.paramsFor('baza-jolly-200', T));
  assert.equal(f.filter(x => x.nume.indexOf('fero.art.cosJolly') === 0).length, 1);
  assert.equal(f.filter(x => /balama/i.test(x.nume)).length, 0, 'balamale pentru un front fără balamale');
  assert.equal(f.find(x => x.nume === 'fero.art.maner').qty, 1);
});

test('se spune ce nu se potrivește cu un coș', () => {
  const av = over => PalCalc.calc(Object.assign(PalModels.paramsFor('baza-jolly', T), over), T)
    .avertismente.map(a => a.cheie);
  assert.deepEqual(av({ W: 250 }), ['jollyLatime']);
  assert.deepEqual(av({ nPol: 2 }), ['jollyFaraPolite']);
  assert.deepEqual(av({ nUsi: 2 }), ['jollyUnFront']);
});

test('se alege din editor și se vede pe card', () => {
  assert.match(citeste('views', 'corps', 'edit.ejs'), /id="jolly"/);
  assert.match(citeste('public', 'app.js'), /var fields = \[[^\]]*'jolly'/);
  assert.match(PalModels.rezumat(PalModels.paramsFor('baza-jolly', T), T), /rezumat\.jolly/);
});

test('textele Jolly există în toate limbile, cu aceiași parametri', () => {
  const chei = ['piesa.frontJolly', 'nota.frontPeCadruJolly', 'avert.jollyUnFront', 'avert.jollyFaraPolite',
    'avert.jollyLatime', 'fero.art.cosJolly', 'fero.art.obsCosJolly', 'editor.jolly', 'editor.jollyNu',
    'editor.jollyDa', 'rezumat.jolly', 'modele.m.baza-jolly-150.nume', 'modele.m.baza-jolly-200.corpNume'];
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
