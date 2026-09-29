'use strict';
/* Înăuntrul corpului atipic: montanți, uși pe compartiment, polițe.

   Dan a desenat-o pe hârtie: un singur corp sub scară, împărțit cu montanți,
   iar fiecare compartiment cu ușa lui și polițele lui. Până atunci corpul
   atipic nu știa niciuna din cele trei — cereai 4 montanți, o ușă și 2 polițe
   și primeai un singur front întreg peste tot golul, fără să-ți spună nimeni.

   Ce e altfel decât la corpul drept e că tavanul e înclinat: fiecare montant,
   fiecare ușă și fiecare poliță se oprește la altă înălțime. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalI18n = require('../shared/i18n');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

/* spațiul din desenul lui: 2400 lat, 1800 în stânga, 500 în dreapta */
const subScara = extra => Object.assign(PalCalc.defaults(T), {
  tip: 'atipic', W: 2400, H: 1800, D: 560, rm: 1.5, ri: 3,
  contur: PalCalc.conturSubScara(2400, 500, 1800)
}, extra || {});

const dinRol = (r, rol) => r.P.filter(p => p.rol === rol);
const cheie = (r, k) => r.P.filter(p => p.cheie === k);

/* ---------------- montanții ---------------- */

test('montanții se fac, fiecare de altă înălțime', () => {
  const m = cheie(PalCalc.calc(subScara({ nDsp: 4 }), T), 'montantAtipic');
  assert.equal(m.length, 4, 'nu ies patru montanți');
  const h = m.map(x => x.L);
  /* sub o pantă care coboară spre dreapta, fiecare e mai scund decât cel dinainte */
  for (let i = 1; i < h.length; i++) {
    assert.ok(h[i] < h[i - 1],
      'montantul ' + (i + 1) + ' (' + h[i] + ') nu e mai scund decât ' + h[i - 1]);
  }
  /* toți în corp, niciunul peste el */
  h.forEach(x => assert.ok(x > 0 && x < 1800, 'montant de ' + x + ' mm'));
});

test('muchia de sus a montantului e tăiată la unghi, și se spune cu cât', () => {
  /* Un montant vertical de 18 mm grosime, pus sub o pantă, are o latură mai
     înaltă decât cealaltă. Fără cota asta omul îl taie drept și rămâne un
     gol în pantă. */
  const m = cheie(PalCalc.calc(subScara({ nDsp: 4 }), T), 'montantAtipic');
  m.forEach(x => {
    assert.equal(x.notaCheie, 'montantSubPanta', 'nu scrie că e tăiat la unghi');
    const mare = +x.notaArgs.mare, mic = +x.notaArgs.mic;
    assert.ok(mare > mic, 'cele două cote sunt egale: ' + mare + '/' + mic);
    assert.equal(mare, x.L, 'cota mare nu e cea din lista de debitare');
    /* diferența e grosimea plăcii înmulțită cu panta: 18 × 1300/2400 ≈ 9.75 */
    const panta = (1800 - 500) / 2400;
    assert.ok(Math.abs((mare - mic) - 18 * panta) < 0.5,
      'diferența e ' + (mare - mic) + ', ar trebui pe la ' + (18 * panta).toFixed(1));
  });
});

test('un corp drept, fără pantă, are montanții dintr-o bucată', () => {
  const drept = subScara({ nDsp: 2, contur: PalCalc.conturImplicit(900, 700), W: 900, H: 700 });
  cheie(PalCalc.calc(drept, T), 'montantAtipic').forEach(x => {
    assert.equal(x.notaCheie, '', 'scrie de tăiere în unghi la un tavan drept');
  });
});

test('montanții care n-au unde să stea nu se fac, și se spune', () => {
  const r = PalCalc.calc(subScara({ nDsp: 6, W: 400, contur: PalCalc.conturSubScara(400, 300, 500) }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'montantiPreaMulti'),
    'șase montanți pe 400 mm trec fără o vorbă');
  assert.equal(cheie(r, 'montantAtipic').length, 0);
});

/* ---------------- ușile ---------------- */

test('fiecare compartiment primește ușa lui, de înălțimea lui', () => {
  const u = dinRol(PalCalc.calc(subScara({ nDsp: 4, nUsi: 1 }), T), 'front');
  assert.equal(u.length, 5, 'patru montanți fac cinci compartimente');
  const h = u.map(x => x.L);
  for (let i = 1; i < h.length; i++) {
    assert.ok(h[i] < h[i - 1], 'ușa ' + (i + 1) + ' nu e mai scundă decât cea dinainte');
  }
  /* toate de aceeași lățime, fiindcă montanții împart egal */
  const late = new Set(u.map(x => x.l));
  assert.equal(late.size, 1, 'ușile au ieșit de lățimi diferite: ' + [...late].join(', '));
});

test('două canaturi pe un compartiment se despart cu rostul dintre ele', () => {
  const unul = dinRol(PalCalc.calc(subScara({ nDsp: 1, nUsi: 1 }), T), 'front');
  const doua = dinRol(PalCalc.calc(subScara({ nDsp: 1, nUsi: 2 }), T), 'front');
  assert.equal(unul.length, 2, 'un montant, două compartimente, o ușă fiecare');
  assert.equal(doua.length, 4, 'două canaturi pe fiecare compartiment');
  /* două canaturi acoperă același gol ca unul singur, minus rostul */
  const latUnul = unul[0].l;
  const latDoua = doua[0].l + doua[1].l;
  assert.ok(Math.abs(latUnul - latDoua - 3) < 0.2,
    'două canaturi de ' + doua[0].l + ' nu acoperă golul de ' + latUnul);
});

test('ușile se pot pune numai pe compartimentele alese', () => {
  const r = PalCalc.calc(subScara({ nDsp: 4, nUsi: 1, compUsi: '1,3,5' }), T);
  assert.equal(dinRol(r, 'front').length, 3, 'trei compartimente alese, trei uși');
});

test('mai mult de două canaturi pe un gol nu se pun, și se spune', () => {
  const r = PalCalc.calc(subScara({ nDsp: 1, nUsi: 4 }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'usiPeCompartimentPreaMulte'));
  assert.equal(dinRol(r, 'front').length, 4, 'două compartimente × două canaturi');
});

test('ușa e front, nu carcasă', () => {
  /* Redenumită din `frontAtipic` în `usaAtipica`, a scăpat o clipă din tabelul
     de roluri și a fost socotită carcasă: ar fi ieșit din alt material, fără
     balamale și fără mâner. */
  assert.equal(PalCalc.rolPiesa('usaAtipica'), 'front');
  assert.equal(PalCalc.rolPiesa('montantAtipic'), 'corp');
});

/* ---------------- polițele ---------------- */

test('polițele se fac în fiecare compartiment, dreptunghiulare', () => {
  const r = PalCalc.calc(subScara({ nDsp: 4, nPol: 2 }), T);
  const pol = cheie(r, 'polita');
  assert.equal(pol.length, 1, 'polițele se grupează într-un singur rând');
  assert.equal(pol[0].buc, 10, 'cinci compartimente × două polițe');
  assert.ok(!r.avertismente.some(a => a.cheie === 'politeAtipic'),
    'încă le refuză, ca înainte');
});

test('nicio poliță nu intră în pantă', () => {
  /* O poliță e un dreptunghi: se oprește acolo unde compartimentul e cel mai
     SCUND. Una pusă mai sus ar intra în panou cu un colț. */
  const p = subScara({ nDsp: 4, nPol: 3 });
  const r = PalCalc.calc(p, T);
  const sus = [];
  r.P.forEach(x => (x.boxes || []).forEach(b => {
    if (b.grp === 'polite') sus.push({ x0: b.x, x1: b.x + b.sx, y: b.y + b.sy });
  }));
  assert.ok(sus.length, 'n-au ieșit polițe');
  sus.forEach(s => {
    const tavanStanga = PalCalc.susLaX(PalCalc.conturGeometrie(p.contur).puncte, s.x0);
    const tavanDreapta = PalCalc.susLaX(PalCalc.conturGeometrie(p.contur).puncte, s.x1);
    const celMaiJos = Math.min(tavanStanga, tavanDreapta);
    assert.ok(s.y <= celMaiJos + 0.01,
      'o poliță urcă la ' + Math.round(s.y) + ', dar tavanul e la ' + Math.round(celMaiJos));
  });
});

test('un compartiment prea scund n-are poliță, și se spune', () => {
  const r = PalCalc.calc(subScara({ nDsp: 4, nPol: 1, contur: PalCalc.conturSubScara(2400, 60, 1800) }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'politeNuIncapAtipic'),
    'compartimentul de la capăt e de câțiva centimetri și primește poliță');
});

/* ---------------- limbile ---------------- */

test('cele opt chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['piesa.montantAtipic', 'piesa.usaAtipica', 'nota.montantSubPanta',
                'avert.montantiPreaMulti', 'avert.montantNuIncape',
                'avert.usiPeCompartimentPreaMulte', 'avert.compUsiFaraMontanti',
                'avert.politeNuIncapAtipic'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = v => (String(v).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
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
