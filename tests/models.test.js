'use strict';
/* Verifica faptul ca fiecare model din catalog chiar se poate construi:
   parametri valizi, piese generate, fara avertismente. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { MODELS, CATEGORIES, paramsFor, sketch, rezumat, byId } = require('../shared/models');
const { calc, paramsSchema } = require('../shared/calc');

test('identificatorii sunt unici, categoriile există', () => {
  const ids = new Set();
  const cats = new Set(CATEGORIES.map(c => c.id));
  for (const m of MODELS) {
    assert.ok(!ids.has(m.id), `id dublat: ${m.id}`);
    ids.add(m.id);
    assert.ok(cats.has(m.cat), `${m.id}: categorie necunoscută „${m.cat}”`);
    assert.ok(m.nume && m.descriere, `${m.id}: lipsește numele sau descrierea`);
  }
  assert.ok(MODELS.length >= 12, 'catalogul e prea mic');
});

test('fiecare model trece validarea parametrilor', () => {
  for (const m of MODELS) {
    const res = paramsSchema.safeParse(paramsFor(m.id));
    assert.ok(res.success, `${m.id}: ${res.success ? '' : JSON.stringify(res.error.issues)}`);
  }
});

test('fiecare model produce piese cu cote pozitive', () => {
  for (const m of MODELS) {
    const { P } = calc(paramsFor(m.id));
    assert.ok(P.length >= 3, `${m.id}: prea puține piese`);
    for (const p of P) {
      assert.ok(p.L > 0 && p.l > 0, `${m.id} / ${p.nume}: cotă finită ≤ 0`);
      assert.ok(p.TL > 0 && p.Tl > 0, `${m.id} / ${p.nume}: cotă de tăiere ≤ 0`);
      assert.ok(p.buc > 0, `${m.id} / ${p.nume}: bucăți ≤ 0`);
    }
  }
});

test('niciun model nu pornește cu avertismente', () => {
  for (const m of MODELS) {
    const { warn } = calc(paramsFor(m.id));
    assert.deepEqual(warn, [], `${m.id}: ${warn.join(' | ')}`);
  }
});

test('modelele cu sertare încap în înălțimea corpului', () => {
  for (const m of MODELS) {
    const p = paramsFor(m.id);
    if (!+p.nSer) continue;
    const ocupat = +p.nSer * (+p.hFront + +p.ri);
    assert.ok(ocupat <= +p.H - 2 * +p.rm + +p.ri + 1,
      `${m.id}: fronturile de sertar (${ocupat} mm) depășesc corpul (${p.H} mm)`);
    assert.ok(+p.hCutie <= +p.hFront, `${m.id}: cutia e mai înaltă decât frontul`);
  }
});

test('schița este un SVG proporțional cu corpul', () => {
  for (const m of MODELS) {
    const p = paramsFor(m.id);
    const svg = sketch(p);
    assert.match(svg, /^<svg /, `${m.id}: nu e SVG`);
    assert.ok(svg.includes(`viewBox="0 0 ${p.W} ${p.H}"`), `${m.id}: viewBox greșit`);
    const fronturi = (svg.match(/class="sk-front"/g) || []).length;
    assert.equal(fronturi, +p.nUsi + +p.nSer, `${m.id}: număr greșit de fronturi desenate`);
  }
});

test('rezumatul descrie conținutul corpului', () => {
  assert.equal(rezumat(paramsFor('baza-2usi')), '2 uși · 1 poliță');
  assert.equal(rezumat(paramsFor('baza-3sertare')), '3 sertare');
  assert.equal(rezumat(paramsFor('baza-nisa')), 'corp deschis');
});

test('un id inexistent nu dă parametri', () => {
  assert.equal(byId('nu-exista'), null);
  assert.equal(paramsFor('nu-exista'), null);
});
