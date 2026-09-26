'use strict';
/* Corpul atipic: contur din laturi și unghiuri, din care ies piesele. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { calc, defaults, conturGeometrie, conturImplicit, numeDirectie } = require('../shared/calc');
const { raport } = require('../shared/raport');

const atipic = (contur, over) => Object.assign(defaults(), {
  tip: 'atipic', D: 560, t: 18, cg: 2, cs: 0.4, nUsi: 0, nPol: 0, nSer: 0,
  spate: 'aplicat', tp: 3, contur
}, over);

/* ---------------- geometria conturului ---------------- */

test('un dreptunghi se închide și dă patru laturi', () => {
  const g = conturGeometrie(conturImplicit(800, 720));
  assert.equal(g.nrLaturi, 4);
  assert.equal(g.inchis, true);
  assert.equal(g.eroare, 0);
  assert.equal(g.W, 800);
  assert.equal(g.H, 720);
  assert.deepEqual(g.laturi.map(l => l.directie.cheie), ['jos', 'dreapta', 'sus', 'stanga']);
  assert.deepEqual(g.laturi.map(l => numeDirectie(l.dir)), ['jos', 'dreapta', 'sus', 'stânga']);
});

test('suma unghiurilor spune dacă un contur poate exista', () => {
  const g = conturGeometrie(conturImplicit(800, 720));
  assert.equal(g.sumaUnghiuri, 360);
  assert.equal(g.sumaCeruta, 360);       // (4 − 2) × 180

  const cinci = conturGeometrie([
    { lung: 800, unghi: 90 }, { lung: 400, unghi: 135 }, { lung: 283, unghi: 135 },
    { lung: 400, unghi: 90 }, { lung: 800, unghi: 90 }
  ]);
  assert.equal(cinci.sumaCeruta, 540);
});

test('un contur care nu se închide semnalează distanța rămasă', () => {
  const g = conturGeometrie([
    { lung: 800, unghi: 90 }, { lung: 700, unghi: 90 },
    { lung: 600, unghi: 90 }, { lung: 700, unghi: 90 }
  ]);
  assert.equal(g.inchis, false);
  assert.equal(g.eroare, 200);           // 800 − 600
});

/* corp sub scară: jos 900, dreapta 400 (partea joasă), panta urcă spre stânga, stânga 800 */
const SUB_SCARA = [
  { lung: 900, unghi: 90 },    // jos
  { lung: 400, unghi: 114 },   // dreapta, apoi cotim pe pantă
  { lung: 985, unghi: 66 },    // panta: hypot(900, 400)
  { lung: 800, unghi: 90 }     // stânga
];

test('corp sub scară: latură înclinată, contur închis', () => {
  const g = conturGeometrie(SUB_SCARA);
  assert.equal(g.nrLaturi, 4);
  assert.equal(g.sumaUnghiuri, 360);
  assert.ok(g.eroare < 2, 'conturul trebuie să se închidă aproape exact, e ' + g.eroare);
  assert.equal(g.W, 900);
  assert.ok(Math.abs(g.H - 800) < 2, 'înălțimea maximă ' + g.H);
  assert.equal(g.laturi[2].directie.cheie, 'inclinata');
  assert.match(numeDirectie(g.laturi[2].dir), /înclinată/);
});

/* ---------------- piesele ---------------- */

test('fiecare latură devine un panou de adâncimea corpului', () => {
  const { P, warn } = calc(atipic(conturImplicit(900, 700)));
  const panouri = P.filter(p => /^Panou/.test(p.nume));

  assert.equal(panouri.length, 4);
  assert.deepEqual(panouri.map(p => p.L), [900, 700, 900, 700]);
  panouri.forEach(p => {
    assert.equal(p.l, 560, 'lățimea panoului este adâncimea corpului');
    assert.equal(p.buc, 1);
    assert.equal(p.TL, p.L - 2, 'cant gros pe muchia din față');
    assert.match(p.nota, /tăiere 45° la un capăt/);
  });
  assert.deepEqual(warn, []);
});

test('spatele se decupează după contur', () => {
  const { P } = calc(atipic(conturImplicit(900, 700)));
  const spate = P.find(p => /^Spate/.test(p.nume));
  assert.equal(spate.L, 900);
  assert.equal(spate.l, 700);
  assert.match(spate.nota, /se decupează după conturul corpului/);
  assert.ok(spate.boxes[0].polyFata, 'spatele trebuie să aibă conturul pentru 3D');
});

test('frontul apare doar dacă e cerut', () => {
  assert.equal(calc(atipic(conturImplicit(900, 700))).P.find(p => p.nume === 'Front'), undefined);
  const cuFront = calc(atipic(conturImplicit(900, 700), { nUsi: 1, rm: 1.5 }));
  const front = cuFront.P.find(p => p.nume === 'Front');
  assert.equal(front.L, 897);            // 900 − 2×1.5
  assert.equal(front.l, 697);
});

test('conturul deschis dă avertisment, nu eroare', () => {
  const { P, warn } = calc(atipic([
    { lung: 800, unghi: 90 }, { lung: 700, unghi: 90 },
    { lung: 600, unghi: 90 }, { lung: 700, unghi: 90 }
  ]));
  assert.ok(P.length > 0, 'piesele se calculează oricum');
  assert.ok(warn.some(w => /nu se închide/.test(w)), warn.join(' | '));
  assert.ok(warn.some(w => /360°/.test(w)), 'trebuie spus ce sumă de unghiuri se cere');
});

test('polițele nu se generează la corpurile atipice', () => {
  const { warn } = calc(atipic(conturImplicit(900, 700), { nPol: 2 }));
  assert.ok(warn.some(w => /Polițele nu se calculează/.test(w)));
});

/* ---------------- raport și CNC ---------------- */

const mat = {
  id: 1, nume: 'PAL alb', rol: 'corp', brand: 'Egger', decor_cod: 'W1000 ST9',
  decor_nume: 'Alb Premium', hex: '#fafcf2', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4
};
const comanda = { id: 1, name: 'Atipic', formate: ['intreaga'], materiale: [mat] };
const OPT = { effortMs: 0, adaosCant: 15 };

test('toate piesele unui corp atipic ajung în lista CNC', () => {
  const r = raport(comanda, [{
    id: 1, name: 'Corp sub scară', poz: 1,
    params: atipic(SUB_SCARA, { nUsi: 1 }),
    materiale: { corp: mat, front: mat, sertar: mat }
  }], OPT);

  const unghiuri = r.cnc.filter(x => x.tip === 'Tăiere la unghi');
  assert.equal(unghiuri.length, 4, 'cele patru laturi se taie la unghi');

  const contururi = r.cnc.filter(x => x.tip === 'Decupare după contur');
  assert.equal(contururi.length, 2, 'spatele și frontul se decupează');
  assert.match(contururi[0].detalii, /se taie dreptunghiul [\d.]+ × [\d.]+ mm/);
  assert.ok(contururi[0].poly, 'planșa are nevoie de contur');
  assert.ok(Math.abs(contururi[0].bounds.y1 - 800) < 2, 'gabaritul urmează conturul');
});

test('un corp atipic dreptunghiular nu cere decupare, doar tăieri la unghi', () => {
  const r = raport(comanda, [{
    id: 1, name: 'Cutie dreaptă', poz: 1,
    params: atipic(conturImplicit(600, 400)),
    materiale: { corp: mat, front: mat, sertar: mat }
  }], OPT);

  assert.equal(r.cnc.filter(x => x.tip === 'Decupare după contur').length, 0);
  assert.equal(r.cnc.filter(x => x.tip === 'Tăiere la unghi').length, 4);
});

test('piesele atipice intră normal în croire și în cant', () => {
  const r = raport(comanda, [{
    id: 1, name: 'Corp sub scară', poz: 1,
    params: atipic(SUB_SCARA),
    materiale: { corp: mat, front: mat, sertar: mat }
  }], OPT);

  assert.ok(r.materiale.length >= 1);
  assert.ok(r.materiale[0].coliIntregi >= 1);
  assert.ok(r.cant.total > 0, 'panourile au cant pe muchia din față');
  assert.equal(r.totaluri.corpuri, 1);
});
