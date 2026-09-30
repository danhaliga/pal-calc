'use strict';
/* Corpul atipic: contur din laturi și unghiuri, din care ies piesele. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { calc, defaults, conturGeometrie, conturImplicit, numeDirectie, conturSubScara } = require('../shared/calc');
const { raport } = require('../shared/raport');

const atipic = (contur, over) => Object.assign(defaults(), {
  tip: 'atipic', D: 560, t: 18, cg: 2, cs: 0.4, nUsi: 0, nPol: 0, nSer: 0,
  /* Testele de aici sunt despre rama ÎN UNGHI. La forma de sub scară (și
     la dreptunghi) implicit e acum rama cu îmbinări drepte — vezi
     tests/sub-scara-drept.test.js. */
  spate: 'aplicat', tp: 3, imbinare: 'unghi', contur
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
    /* Cantul gros stă pe muchia din față, care merge pe lungimea panoului.
       Banda de pe ea îngroașă panoul pe lățime, deci lungimea rămâne întreagă
       iar lățimea scade cu 1.5 (cant de 2 mm). */
    assert.equal(p.TL, p.L, 'lungimea nu se atinge: cantul e pe muchia paralelă cu ea');
    assert.equal(p.Tl, 558.5, 'lățimea scade cu 1.5, cât ia cantul de 2 mm');
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

test('ușile apar doar dacă sunt cerute, și acoperă carcasa', () => {
  const usi = r => r.P.filter(p => p.rol === 'front');
  assert.deepEqual(usi(calc(atipic(conturImplicit(900, 700)))), []);

  /* Ușa aplicată acoperă carcasa: merge până la muchia din afară, mai puțin
     rostul de margine. Socotită pe golul dinăuntru ar ieși cu o grosime de
     placă mai îngustă, și s-ar vedea lateralele. */
  const una = usi(calc(atipic(conturImplicit(900, 700), { nUsi: 1, rm: 1.5 })));
  assert.equal(una.length, 1);
  assert.equal(una[0].l, 897);           // 900 − 2×1.5
  assert.equal(una[0].L, 697);

  /* Două canaturi pe același gol se despart cu rostul dintre ele. */
  const doua = usi(calc(atipic(conturImplicit(900, 700), { nUsi: 2, rm: 1.5, ri: 3 })));
  assert.equal(doua.length, 2);
  doua.forEach(u => assert.equal(u.l, 447));   // (897 − 3) / 2

  /* Cu montanți, câte una pe compartiment. */
  /* Golurile: (900 − 2×18 − 2×18) / 3 = 276. Ușa de la capăt merge de la
     muchia din afară (1.5) până la mijlocul montantului (303), minus
     jumătate de rost: 300. Cea din mijloc stă între două mijloace de
     montant (303 … 597), minus rosturile: 291. */
  const trei = usi(calc(atipic(conturImplicit(900, 700), { nUsi: 1, nDsp: 2, rm: 1.5, ri: 3 })));
  assert.equal(trei.length, 3);
  assert.deepEqual(trei.map(u => u.l), [300, 291, 300]);
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

test('polițele se fac, câte una pe compartiment, dreptunghiulare', () => {
  /* Pana la 29 septembrie corpul atipic le refuza cu totul: „adauga-le ca
     piese separate". Acum se fac — dreptunghiulare, cate incap, si se opresc
     acolo unde compartimentul e cel mai scund, ca sa nu intre in panta. */
  const r = calc(atipic(conturImplicit(900, 700), { nPol: 2 }));
  const pol = r.P.filter(p => p.cheie === 'polita');
  assert.equal(pol.length, 1, 'polițele se grupează într-un singur rând');
  assert.equal(pol[0].buc, 2);
  assert.ok(!r.warn.some(w => /nu se calculează/.test(w)), 'încă le refuză');

  /* Cu montanți: câte `nPol` în fiecare compartiment. */
  const cu = calc(atipic(conturImplicit(900, 700), { nPol: 2, nDsp: 2 }));
  assert.equal(cu.P.filter(p => p.cheie === 'polita')[0].buc, 6);

  /* Sub panta, compartimentul scund primeste politele mai jos decat cel inalt,
     dar niciuna nu iese din corp. */
  const subScara = calc(atipic(conturSubScara(2400, 500, 1800),
                               { nPol: 1, nDsp: 3, W: 2400 }));
  const y = [];
  subScara.P.forEach(p => (p.boxes || []).forEach(b => {
    if (b.grp === 'polite') y.push(b.y);
  }));
  assert.equal(y.length, 4, 'patru compartimente, o poliță în fiecare');
  y.sort((a, b) => a - b);
  assert.ok(y[0] < y[y.length - 1], 'toate au ieșit la aceeași înălțime');
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

/* 3D-ul și planșa de montaj pun `polyFata` direct în coordonatele corpului.
   Dacă un contur ar fi dat față de colțul piesei, piesa ar zbura din corp. */
test('conturul pieselor sub scară e în coordonatele corpului, peste cutia piesei', () => {
  const r = calc(Object.assign(defaults(), { tip: 'atipic', W: 1000, H: 2800, D: 560, nUsi: 1, nPol: 2, contur: [
    { lung: 1000, unghi: 90 }, { lung: 2600, unghi: 101.31 }, { lung: 1019.8, unghi: 78.69 }, { lung: 2800, unghi: 90 }] }));
  let n = 0;
  r.P.forEach(p => (p.boxes || []).forEach(b => {
    if (!b.polyFata) return;
    n++;
    b.polyFata.forEach(([x, y]) => {
      assert.ok(x >= b.x - 2 && x <= b.x + b.sx + 2, p.cheie + ': x ' + x + ' în afara piesei ' + b.x + '+' + b.sx);
      assert.ok(y >= b.y - 2 && y <= b.y + b.sy + 2, p.cheie + ': y ' + y + ' în afara piesei ' + b.y + '+' + b.sy);
    });
  }));
  assert.ok(n >= 4);
});
