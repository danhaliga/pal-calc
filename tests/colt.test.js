'use strict';
/* Corpuri de colț: orb, în L și cu front diagonal.
   Valorile așteptate sunt calculate manual, pentru un corp de 900 × 900,
   adâncimea brațelor 560, PAL 18, rost margine 1.5, rost între fronturi 3. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { calc, defaults, balamale } = require('../shared/calc');

const colt = (over) => Object.assign(defaults(), {
  W: 900, W2: 900, H: 720, D: 560, t: 18, cg: 2, cs: 0.4,
  rm: 1.5, ri: 3, nPol: 1, jp: 1, rp: 20, nSer: 0
}, over);

const find = (P, nume) => P.find(p => p.nume === nume);

/* ---------------- colț orb ---------------- */

test('colț orb: corp dreptunghiular, ușă îngustată de zona oarbă', () => {
  const c = Object.assign(defaults(), { tip: 'colt-orb', W: 1000, H: 720, D: 560, orb: 550, nUsi: 1, nPol: 1 });
  const { P, warn } = calc(c);

  const usa = find(P, 'Ușă');
  assert.equal(usa.buc, 1);
  assert.equal(usa.l, 447);            // 1000 − 550 − 2×1.5
  assert.equal(usa.L, 717);            // 720 − 2×1.5
  assert.equal(usa.Tl, 444);           // 447 − 2×1.5 (cantul de 2 mm ia 1.5)
  assert.match(usa.nota, /zonă oarbă de 550 mm/);

  /* restul corpului rămâne un corp drept, pe toată lățimea */
  assert.equal(find(P, 'Blat').L, 964);        // 1000 − 2×18
  assert.equal(find(P, 'Laterală').L, 720);
  assert.equal(find(P, 'Poliță').L, 963);      // 964 − joc 1
  // polița de 963 mm chiar se lasă: avertismentul e corect
  assert.deepEqual(warn, ['Poliță de 963 mm: peste 800 mm PAL-ul de 18 se îndoaie; ' +
    'folosește PAL 25 sau un montant central.']);
  assert.deepEqual(calc(Object.assign(c, { nPol: 0 })).warn, []);
});

test('colț orb: zona oarbă mai mare decât corpul dă avertisment', () => {
  const { warn } = calc(Object.assign(defaults(), { tip: 'colt-orb', W: 600, orb: 600, nUsi: 1 }));
  assert.ok(warn.some(w => /Zona oarbă/.test(w)), warn.join(' | '));
});

test('corpul drept nu e afectat de parametrul zonei oarbe', () => {
  const drept = calc(Object.assign(defaults(), { orb: 550 }));
  const referinta = calc(defaults());
  assert.deepEqual(drept.P, referinta.P);
});

/* ---------------- colț în L ---------------- */

test('colț în L: laterale, panouri decupate, două fronturi', () => {
  const { P, warn } = calc(colt({ tip: 'colt-L' }));

  const lat = find(P, 'Laterală');
  assert.equal(lat.buc, 2);
  assert.equal(lat.L, 720);
  assert.equal(lat.l, 560);
  /* cantul gros stă pe muchia frontală, care merge pe L: scade din l, nu din L.
     Canturile subțiri (0.4) de sus și de jos nu schimbă cota deloc. */
  assert.equal(lat.TL, 720);
  assert.equal(lat.Tl, 558.5);

  for (const nume of ['Blat', 'Fund']) {
    const p = find(P, nume);
    assert.equal(p.L, 882, `${nume}: gabarit pe latura 1`);   // 900 − 18
    assert.equal(p.l, 882, `${nume}: gabarit pe latura 2`);
    assert.equal(p.TL, 882, `${nume}: se debitează dreptunghiul întreg`);
    assert.match(p.nota, /decupează colțul 322×322/);          // 882 − 560
  }

  const u1 = find(P, 'Ușă braț 1'), u2 = find(P, 'Ușă braț 2');
  assert.equal(u1.L, 717);
  assert.equal(u1.l, 319);             // (882 − 560) − 1.5 − 1.5
  assert.equal(u2.l, 319);
  assert.equal(u1.Tl, 316);            // 319 − 2×1.5
  assert.match(u1.nota, /balama-carte/);

  const pol = find(P, 'Poliță');
  assert.equal(pol.L, 881);            // 882 − joc 1
  assert.match(pol.nota, /formă de L/);

  // o poliță de colț cu laturi de 881 mm se lasă: avertisment așteptat
  assert.ok(warn.some(w => /Poliță de colț/.test(w)), warn.join(' | '));
  assert.deepEqual(calc(colt({ tip: 'colt-L', nPol: 0 })).warn, []);
});

test('colț în L: două panouri de spate, câte unul pe fiecare perete', () => {
  const { P } = calc(colt({ tip: 'colt-L', tp: 3 }));
  const s1 = P.find(p => /peretele 1/.test(p.nume));
  const s2 = P.find(p => /peretele 2/.test(p.nume));
  assert.equal(s1.l, 897);             // 900 − 3
  assert.equal(s2.l, 894);             // 900 − 3 − 3 (se sprijină pe primul)
  assert.equal(s1.L, 717);
});

/* ---------------- colț diagonal ---------------- */

test('colț diagonal: un singur front, pe diagonala de 455 mm', () => {
  const { P, warn } = calc(colt({ tip: 'colt-diagonal' }));

  const usa = find(P, 'Ușă diagonală');
  assert.equal(usa.buc, 1);
  assert.equal(usa.L, 717);
  assert.equal(usa.l, 452.4);          // diagonala 455.4 − 2×1.5
  assert.equal(usa.Tl, 449.4);         // 452.4 − 2×1.5
  assert.equal(balamale(usa.L), 2);

  const blat = find(P, 'Blat');
  assert.equal(blat.L, 882);
  assert.match(blat.nota, /45°/);
  assert.match(blat.nota, /muchia diagonală 455\.4 mm/);

  assert.equal(find(P, 'Ușă braț 1'), undefined);
  assert.ok(warn.every(w => /Poliță de colț/.test(w)), warn.join(' | '));
  assert.deepEqual(calc(colt({ tip: 'colt-diagonal', nPol: 0 })).warn, []);
});

test('colț diagonal: diagonala crește cu laturile', () => {
  const mic = calc(colt({ tip: 'colt-diagonal', W: 600, W2: 600, D: 320 }));
  const usa = find(mic.P, 'Ușă diagonală');
  // catete 600 − 18 − 320 = 262 → diagonala 370.5
  assert.equal(usa.l, 367.5);
});

/* ---------------- limite și geometrie 3D ---------------- */

test('adâncime prea mare pentru laturi: avertisment', () => {
  const { warn } = calc(colt({ tip: 'colt-L', W: 600, W2: 600, D: 600 }));
  assert.ok(warn.some(w => /nu mai rămâne colț/.test(w)), warn.join(' | '));
});

test('sertarele nu se calculează la corpurile de colț', () => {
  const { P, warn } = calc(colt({ tip: 'colt-L', nSer: 2 }));
  assert.ok(warn.some(w => /Sertarele nu se calculează/.test(w)));
  assert.equal(P.find(p => /Sertar/.test(p.nume)), undefined);
});

test('panourile de colț au contur poligonal pentru 3D', () => {
  for (const tip of ['colt-L', 'colt-diagonal']) {
    const { P } = calc(colt({ tip }));
    const blat = find(P, 'Blat');
    const poly = blat.boxes[0].poly;
    assert.ok(Array.isArray(poly), `${tip}: lipsește conturul`);
    assert.equal(poly.length, tip === 'colt-L' ? 6 : 5, `${tip}: număr de colțuri`);
    /* conturul pornește din colțul dinspre pereți și se închide corect */
    assert.deepEqual(poly[0], [0, 0]);
    assert.deepEqual(poly[1], [882, 0]);
  }
});

test('ușa diagonală este rotită în plan', () => {
  const { P } = calc(colt({ tip: 'colt-diagonal' }));
  const box = find(P, 'Ușă diagonală').boxes[0];
  assert.ok(typeof box.ry === 'number');
  assert.equal(Math.round(box.ry * 180 / Math.PI), -135);
});

test('toate piesele de colț au cote pozitive', () => {
  for (const tip of ['colt-orb', 'colt-L', 'colt-diagonal']) {
    const { P } = calc(colt({ tip, nUsi: 1 }));
    for (const p of P) {
      assert.ok(p.L > 0 && p.l > 0 && p.TL > 0 && p.Tl > 0, `${tip} / ${p.nume}`);
      assert.ok(p.boxes.length > 0, `${tip} / ${p.nume}: fără geometrie`);
    }
  }
});
