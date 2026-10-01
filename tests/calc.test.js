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

test('ușă aplicată: finit 717 × 397, tăiere 714 × 394', () => {
  const { P } = calc(base());
  const usa = find(P, 'Ușă');
  assert.ok(usa, 'piesa "Ușă" trebuie să existe');
  assert.equal(usa.buc, 2);
  assert.equal(usa.L, 717);
  assert.equal(usa.l, 397);
  /* cant 2 mm pe toate patru: scade 1.5 pe fiecare muchie, nu 2 */
  assert.equal(usa.TL, 714);
  assert.equal(usa.Tl, 394);
  assert.deepEqual(usa.c, ['g', 'g', 'g', 'g']);
});

test('laterală cu spate PFL 3 aplicat: finit 720 × 557, tăiere 720 × 555.5', () => {
  const { P } = calc(base());
  const lat = find(P, 'Laterală');
  assert.equal(lat.buc, 2);
  assert.equal(lat.L, 720);
  assert.equal(lat.l, 557);
  /* cantul gros stă pe muchia din față, care merge pe L — deci scade din l.
     Cele două canturi subțiri (0.4) nu schimbă cota deloc. */
  assert.equal(lat.TL, 720);
  assert.equal(lat.Tl, 555.5);
});

test('blat și fund: finit 764 × 557, tăiere 764 × 555.5', () => {
  const { P } = calc(base());
  for (const nume of ['Blat', 'Fund']) {
    const p = find(P, nume);
    assert.equal(p.L, 764, `${nume}: finit L`);
    assert.equal(p.l, 557, `${nume}: finit l`);
    assert.equal(p.TL, 764, `${nume}: tăiere L`);
    assert.equal(p.Tl, 555.5, `${nume}: tăiere l`);
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
  /* Fronturile umplu corpul: 2 x 357 + 3 rost = 717, cat fata lui. Cu 150
     ar ramane 414 mm gol jos, iar calculul se plange pe buna dreptate —
     si atunci `warn.length === 0` de mai jos n-ar mai insemna nimic. */
  const c = Object.assign(base(), { nUsi: 0, nPol: 0, nSer: 2, hFront: 357, hCutie: 100, jg: 12.5, ts: 16 });
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

/* Piesa simplă cu mai multe rânduri: un produs, o plată, toate piesele în listă. */
test('piesa simplă: rândurile în plus intră în listă, cu numele și cantul lor', () => {
  const p = Object.assign(defaults(), { tip: 'piesa', W: 1200, H: 600, pBuc: 1, pieseExtra: [
    { nume: 'Mască', L: 720, l: 100, buc: 2, cL1: 'g', cL2: '-', cl1: '-', cl2: '-', fibra: 'L' },
    { nume: '', L: 500, l: 300, buc: 5, cL1: '-', cL2: '-', cl1: '-', cl2: '-', fibra: 'l' }
  ] });
  const r = calc(p);
  assert.equal(r.P.length, 3);
  assert.deepEqual(r.P.map(x => x.buc), [1, 2, 5]);
  assert.equal(r.P[1].nume, 'Mască');
  assert.equal(r.P[2].nume, 'Piesă 3', 'fără nume, piesa își ia numărul din listă');
  assert.equal(r.P[1].Tl, 98.5, 'cantul gros de pe L1 scade lățimea');
  assert.equal(r.P[2].fibra, 'l');
  /* în 3D nu stau una peste alta */
  assert.ok(r.P[1].boxes[0].x >= 1200 && r.P[2].boxes[0].x >= r.P[1].boxes[0].x + 720);
});

test('piesa simplă: o cotă greșită într-un rând e refuzată, nu golește lista', () => {
  const p = Object.assign(defaults(), { tip: 'piesa', W: 1200, H: 600 });
  assert.equal(paramsSchema.safeParse(Object.assign({}, p, { pieseExtra: [{ L: 720, l: 100 }] })).success, true);
  assert.equal(paramsSchema.safeParse(Object.assign({}, p, { pieseExtra: [{ L: 5, l: 100 }] })).success, false);
  assert.equal(paramsSchema.safeParse(Object.assign({}, p, { pieseExtra: [{ L: '', l: 100 }] })).success, false);
  const vechi = Object.assign({}, p); delete vechi.pieseExtra;
  assert.equal(paramsSchema.safeParse(vechi).success, true, 'piesele salvate înainte n-au lista');
});

/* Sertarele cu fronturi inegale (1 octombrie 2026). */
test('sertare inegale: fronturile umplu exact corpul, cutia se ia din front', () => {
  const PalModels = require('../shared/models');
  const b = Object.assign(defaults(), PalModels.paramsFor('baza-2usi'), { W: 600, nUsi: 0, nPol: 0, nSer: 3 });
  const plin = r => r.sertare.reduce((s, x) => s + x.front, 0) + (r.sertare.length - 1) * 3;
  const jum = calc(Object.assign({}, b, { sertareH: '140,r,50%' }));
  assert.deepEqual(jum.sertare.map(x => x.front), [140, 212.5, 358.5]);
  assert.deepEqual(jum.sertare.map(x => x.cutie), [100, 150, 180]);
  assert.equal(plin(jum), 717, 'fronturile + rosturile = tot frontul');
  assert.equal(jum.warn.length, 0);
  /* cutia scrisă de mână bate regula */
  const mana = calc(Object.assign({}, b, { sertareH: '140,r,50%', sertareC: ',120,' }));
  assert.deepEqual(mana.sertare.map(x => x.cutie), [100, 120, 180]);
  /* fronturi care nu umplu: avertisment cu „r" */
  assert.ok(calc(Object.assign({}, b, { sertareH: '140,140,140' })).warn.some(w => /„r”|"r"|r”/.test(w) || /rest/.test(w)));
  /* lista goală = felul vechi, neschimbat */
  const vechi = calc(Object.assign({}, b, { hFront: 237, hCutie: 180 }));
  assert.deepEqual(vechi.sertare.map(x => [x.front, x.cutie]), [[237, 180], [237, 180], [237, 180]]);
});

test('schema: fronturile acceptă mm, „r" și procente; altceva se refuză', () => {
  const p = Object.assign(defaults(), { nSer: 3, nUsi: 0 });
  ['', 'r,r,r', '140,r,50%', '140.5,r'].forEach(v =>
    assert.equal(paramsSchema.safeParse(Object.assign({}, p, { sertareH: v })).success, true, v));
  ['abc', '140,,r', '<script>'].forEach(v =>
    assert.equal(paramsSchema.safeParse(Object.assign({}, p, { sertareH: v })).success, false, v));
});

test('un card pe categorie; configurările rapide dau corpurile din catalog', () => {
  const PalModels = require('../shared/models');
  const piese = p => calc(p).P.map(x => x.cheie + ' ' + x.buc + ' ' + x.TL + 'x' + x.Tl).sort().join('|');
  const grupe = PalModels.configurariRapide();
  const carduri = PalModels.modele();
  assert.equal(carduri.length, grupe.length, 'câte un card pe categorie');
  grupe.forEach(g => {
    assert.ok(carduri.some(m => m.cat === g.cat));
    const baza = PalModels.paramsFor(PalModels.BAZA_FAMILIE[g.cat]);
    g.configs.forEach(c => {
      const tinta = PalModels.paramsFor(c.id);
      const p = Object.assign({}, baza, g.cat === 'bucatarie-jos' ? { W: tinta.W, H: tinta.H } : {}, c.set);
      assert.equal(paramsSchema.safeParse(p).success, true, c.id + ': schema');
      assert.equal(piese(p), piese(tinta), c.id);
      assert.equal(c.set.familie, g.cat);
    });
  });
  assert.equal(grupe.reduce((s, g) => s + g.configs.length, 0), PalModels.MODELS.filter(m => m.id !== 'piesa-simpla').length,
               'niciun model pierdut');
});
