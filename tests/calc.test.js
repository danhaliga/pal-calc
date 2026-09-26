'use strict';
/* Teste pe motorul de calcul: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert/strict');
const { calc, defaults, balamale, csv, paramsSchema, NUT_OFF, NUT_AD, PFL_SERTAR } = require('../shared/calc');

const base = () => Object.assign(defaults(), {
  W: 800, H: 720, D: 560, t: 18, cg: 2, cs: 0.4,
  nUsi: 2, montaj: 'aplicat', rm: 1.5, ri: 3, spate: 'aplicat', tp: 3
});

const find = (P, nume) => P.find(p => p.nume === nume);

test('ușă aplicată: finit 717 × 397, tăiere 713 × 393', () => {
  const { P } = calc(base());
  const usa = find(P, 'Ușă');
  assert.ok(usa, 'piesa "Ușă" trebuie să existe');
  assert.equal(usa.buc, 2);
  assert.equal(usa.L, 717);
  assert.equal(usa.l, 397);
  assert.equal(usa.TL, 713);
  assert.equal(usa.Tl, 393);
  assert.deepEqual(usa.c, ['g', 'g', 'g', 'g']);
});

test('laterală cu spate PFL 3 aplicat: finit 720 × 557, tăiere 718 × 556.2', () => {
  const { P } = calc(base());
  const lat = find(P, 'Laterală');
  assert.equal(lat.buc, 2);
  assert.equal(lat.L, 720);
  assert.equal(lat.l, 557);
  assert.equal(lat.TL, 718);
  assert.equal(lat.Tl, 556.2);
});

test('blat și fund: finit 764 × 557, tăiere 762 × 557', () => {
  const { P } = calc(base());
  for (const nume of ['Blat', 'Fund']) {
    const p = find(P, nume);
    assert.equal(p.L, 764, `${nume}: finit L`);
    assert.equal(p.l, 557, `${nume}: finit l`);
    assert.equal(p.TL, 762, `${nume}: tăiere L`);
    assert.equal(p.Tl, 557, `${nume}: tăiere l`);
  }
});

test('numărul de balamale după înălțimea ușii', () => {
  assert.equal(balamale(900), 2);
  assert.equal(balamale(901), 3);
  assert.equal(balamale(1600), 3);
  assert.equal(balamale(1700), 4);
  assert.equal(balamale(2001), 5);
});

test('ușă de 1700 mm primește 4 balamale, scris în notă', () => {
  const c = Object.assign(base(), { H: 1704, nUsi: 1, nPol: 0 });
  const { P } = calc(c);
  const usa = find(P, 'Ușă');
  assert.equal(usa.L, 1701);
  assert.match(usa.nota, /^4 balamale/);
});

test('poliță peste 800 mm generează avertisment', () => {
  const { P, warn } = calc(Object.assign(base(), { W: 1000, nPol: 1 }));
  const pol = find(P, 'Poliță');
  assert.equal(pol.L, 963);                       // 1000 − 2×18 − joc 1
  assert.ok(warn.some(w => /peste 800 mm/.test(w)), 'lipsește avertismentul pentru poliță');
});

test('interiorul corpului și adâncimile', () => {
  const r = calc(base());
  assert.equal(r.Wint, 764);
  assert.equal(r.Hint, 684);
  assert.equal(r.Dint, 557);                      // spate aplicat: 560 − 3
  const nut = calc(Object.assign(base(), { spate: 'nut' }));
  assert.equal(nut.Dint, 560 - NUT_OFF - 3);      // nut: 560 − 10 − 3
});

test('construcție „peste”: lateralele scad, blatul ține toată lățimea', () => {
  const { P } = calc(Object.assign(base(), { constr: 'peste' }));
  assert.equal(find(P, 'Blat').L, 800);
  assert.equal(find(P, 'Laterală').L, 684);
});

test('spate în nut: cotele includ adâncimea nutului', () => {
  const { P } = calc(Object.assign(base(), { spate: 'nut' }));
  const sp = find(P, 'Spate în nut');
  assert.equal(sp.L, 684 + 2 * (NUT_AD - 1));
  assert.equal(sp.l, 764 + 2 * (NUT_AD - 1));
});

test('sertare: cutie, fund PFL și avertisment la glisieră prea lungă', () => {
  const c = Object.assign(base(), { nUsi: 0, nPol: 0, nSer: 2, hFront: 150, hCutie: 100, jg: 12.5, ts: 16 });
  const { P, warn } = calc(c);
  assert.equal(find(P, 'Front sertar').buc, 2);
  assert.equal(find(P, 'Sertar – laterală cutie').buc, 4);
  assert.equal(find(P, 'Sertar – fund PFL').l, 764 - 2 * 12.5);
  assert.equal(warn.length, 0);

  const lung = calc(Object.assign(c, { lg: 600 }));
  assert.ok(lung.warn.some(w => /nu încape/.test(w)));
});

test('fronturile de sertar consumă înălțimea ușii', () => {
  const c = Object.assign(base(), { nUsi: 1, nSer: 1, hFront: 150, ri: 3 });
  const { P } = calc(c);
  assert.equal(find(P, 'Ușă').L, 717 - (150 + 3));
});

test('cantul zero înseamnă cotă de tăiere egală cu cea finită', () => {
  const { P } = calc(Object.assign(base(), { cg: 0, cs: 0 }));
  P.forEach(p => {
    assert.equal(p.TL, p.L, `${p.nume}: TL`);
    assert.equal(p.Tl, p.l, `${p.nume}: Tl`);
  });
});

test('fundul de sertar are grosimea PFL constantă', () => {
  const { P } = calc(Object.assign(base(), { nSer: 1 }));
  const fund = find(P, 'Sertar – fund PFL');
  assert.equal(fund.boxes[0].sy, PFL_SERTAR);
});

test('fiecare piesă are geometrie 3D', () => {
  const { P } = calc(Object.assign(base(), { nSer: 1, nPol: 2 }));
  P.forEach(p => assert.ok(p.boxes.length > 0, `${p.nume} nu are boxes`));
});

test('CSV conține antetul și o linie per piesă', () => {
  const c = base();
  const text = csv([c]);
  const lines = text.trim().split('\n');
  assert.match(lines[0], /^Corp;Piesă;Buc/);
  assert.equal(lines.length, calc(c).P.length + 1);
});

test('paramsSchema acceptă valori corecte și respinge aberații', () => {
  assert.ok(paramsSchema, 'zod trebuie instalat');
  assert.equal(paramsSchema.safeParse(base()).success, true);

  assert.equal(paramsSchema.safeParse(Object.assign(base(), { W: 50 })).success, false);
  assert.equal(paramsSchema.safeParse(Object.assign(base(), { W: 5000 })).success, false);
  assert.equal(paramsSchema.safeParse(Object.assign(base(), { spate: 'carton' })).success, false);
  assert.equal(paramsSchema.safeParse(Object.assign(base(), { nUsi: 99 })).success, false);

  const coerced = paramsSchema.safeParse(Object.assign(base(), { W: '820', balama: 18 }));
  assert.equal(coerced.success, true);
  assert.equal(coerced.data.W, 820);
  assert.equal(coerced.data.balama, '18');
});
