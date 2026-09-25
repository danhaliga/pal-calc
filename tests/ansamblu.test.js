'use strict';
/* Ansamblul: așezarea corpurilor pe pereți, alipirea, suprapunerile și golurile. */

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../shared/ansamblu');
const { defaults } = require('../shared/calc');

const corp = (id, nume, over, pozitie) => ({
  id, nume, pozitie: pozitie || null,
  params: Object.assign(defaults(), { nume }, over)
});

const comanda = (cam) => ({ id: 1, name: 'Test', camera: cam || { A: 3200, B: 2400, H: 2500 } });

/* ---------------- camera și pereții ---------------- */

test('camera are valori implicite sănătoase', () => {
  assert.deepEqual(A.camera(null), { A: 3200, B: 2400, H: 2500 });
  assert.deepEqual(A.camera({ A: 4000, B: 3000, H: 2700 }), { A: 4000, B: 3000, H: 2700 });
});

test('pereții A și C sunt pe latura lungă, B și D pe cea scurtă', () => {
  const cam = { A: 3200, B: 2400, H: 2500 };
  assert.equal(A.lungimePerete(cam, 'A'), 3200);
  assert.equal(A.lungimePerete(cam, 'C'), 3200);
  assert.equal(A.lungimePerete(cam, 'B'), 2400);
  assert.equal(A.lungimePerete(cam, 'D'), 2400);
});

/* ---------------- alipirea ---------------- */

test('alipirea pune corpurile cap la cap, din colț', () => {
  const corpuri = [
    corp(1, 'Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560 }),
    corp(2, 'Chiuvetă', { W: 800, D: 560 }),
    corp(3, 'Sertare', { W: 600, D: 560 }),
    corp(4, 'Bază', { W: 900, D: 560 })
  ];
  const r = A.alipeste(corpuri, A.camera(), 'A', 0);

  assert.deepEqual(r.pozitii.map(p => p.d), [0, 900, 1700, 2300]);
  assert.equal(r.lungime, 3200);
  assert.equal(r.lungimePerete, 3200);
  assert.ok(r.pozitii.every(p => p.perete === 'A'));
});

test('alipirea poate porni de la o distanță dată', () => {
  const r = A.alipeste([corp(1, 'X', { W: 600, D: 560 })], A.camera(), 'B', 900);
  assert.equal(r.pozitii[0].d, 900);
  assert.equal(r.lungime, 1500);
});

/* ---------------- așezarea în plan ---------------- */

test('corpul de pe peretele din spate ocupă dreptunghiul așteptat', () => {
  const cam = A.camera();
  const a = A.asezare(corp(1, 'Bază', { W: 800, H: 720, D: 560 }), { perete: 'A', d: 900, h: 0 }, cam);

  assert.deepEqual(a.plan, { x0: 900, z0: 0, x1: 1700, z1: 560 });
  assert.equal(a.rotatie, 0);
  assert.deepEqual(a.origine, { x: 900, y: 0, z: 0 });
});

test('pe fiecare perete, corpul intră în cameră, nu iese din ea', () => {
  const cam = A.camera({ A: 3000, B: 2000, H: 2500 });
  const c = corp(1, 'Corp', { W: 800, H: 720, D: 560 });

  for (const perete of ['A', 'B', 'C', 'D']) {
    const a = A.asezare(c, { perete, d: 200, h: 0 }, cam);
    const p = a.plan;
    assert.ok(p.x0 >= -0.01 && p.x1 <= cam.A + 0.01, `peretele ${perete}: iese pe X`);
    assert.ok(p.z0 >= -0.01 && p.z1 <= cam.B + 0.01, `peretele ${perete}: iese pe Z`);
    assert.equal(Math.round(p.x1 - p.x0), perete === 'A' || perete === 'C' ? 800 : 560);
    assert.equal(Math.round(p.z1 - p.z0), perete === 'A' || perete === 'C' ? 560 : 800);
  }
});

test('corpurile suspendate stau la înălțime, nu pe podea', () => {
  const cam = A.camera();
  const a = A.asezare(corp(1, 'Suspendat', { W: 800, H: 720, D: 320 }), { perete: 'A', d: 0, h: 1400 }, cam);
  assert.equal(a.origine.y, 1400);
  assert.equal(a.H, 720);
});

/* ---------------- verificări ---------------- */

test('depășirea peretelui este semnalată', () => {
  const cam = A.camera({ A: 2000, B: 2000, H: 2500 });
  const a = A.asezare(corp(1, 'Lung', { W: 900, H: 720, D: 560 }), { perete: 'A', d: 1400, h: 0 }, cam);
  const p = A.verifica([a], cam);
  assert.equal(p.length, 1);
  assert.equal(p[0].tip, 'depasire');
  assert.match(p[0].text, /depășește peretele A cu 300 mm/);
});

test('depășirea înălțimii camerei este semnalată', () => {
  const cam = A.camera({ A: 3000, B: 2000, H: 2000 });
  const a = A.asezare(corp(1, 'Înalt', { W: 800, H: 720, D: 560 }), { perete: 'A', d: 0, h: 1500 }, cam);
  const p = A.verifica([a], cam);
  assert.ok(p.some(x => x.tip === 'inaltime'), JSON.stringify(p));
});

test('două corpuri care se calcă pe același perete sunt semnalate', () => {
  const cam = A.camera();
  const a1 = A.asezare(corp(1, 'Unu', { W: 800, H: 720, D: 560 }), { perete: 'A', d: 0, h: 0 }, cam);
  const a2 = A.asezare(corp(2, 'Doi', { W: 800, H: 720, D: 560 }), { perete: 'A', d: 600, h: 0 }, cam);
  const p = A.verifica([a1, a2], cam);
  assert.equal(p.length, 1);
  assert.equal(p[0].tip, 'suprapunere');
  assert.match(p[0].text, /pe 200 mm/);
});

test('corpurile alipite corect nu dau nicio problemă', () => {
  const cam = A.camera();
  const corpuri = [
    corp(1, 'Unu', { W: 800, H: 720, D: 560 }),
    corp(2, 'Doi', { W: 600, H: 720, D: 560 }),
    corp(3, 'Trei', { W: 900, H: 720, D: 560 })
  ];
  const r = A.alipeste(corpuri, cam, 'A', 0);
  const asezari = corpuri.map((c, i) => A.asezare(c, r.pozitii[i], cam));
  assert.deepEqual(A.verifica(asezari, cam), []);
});

test('un corp jos și unul sus, în același loc, nu se suprapun', () => {
  const cam = A.camera();
  const jos = A.asezare(corp(1, 'Jos', { W: 800, H: 720, D: 560 }), { perete: 'A', d: 0, h: 0 }, cam);
  const sus = A.asezare(corp(2, 'Sus', { W: 800, H: 720, D: 320 }), { perete: 'A', d: 0, h: 1400 }, cam);
  assert.deepEqual(A.verifica([jos, sus], cam), []);
});

/* ---------------- goluri ---------------- */

test('golul rămas pe perete este calculat', () => {
  const cam = A.camera({ A: 3000, B: 2000, H: 2500 });
  const corpuri = [corp(1, 'Unu', { W: 800, H: 720, D: 560 }), corp(2, 'Doi', { W: 600, H: 720, D: 560 })];
  const r = A.alipeste(corpuri, cam, 'A', 0);
  const asezari = corpuri.map((c, i) => A.asezare(c, r.pozitii[i], cam));

  const g = A.goluri(asezari, cam);
  assert.equal(g.length, 1);
  assert.equal(g[0].perete, 'A');
  assert.equal(g[0].de_la, 1400);
  assert.equal(g[0].lung, 1600);
});

test('brațul colțului nu e raportat ca gol pe peretele vecin', () => {
  const cam = A.camera({ A: 1800, B: 1500, H: 2500 });
  /* colț 900×900 pe A, iar pe B restul de 600 începe după brațul colțului */
  const colt = corp(1, 'Colț', { tip: 'colt-L', W: 900, W2: 900, H: 720, D: 560 },
                    { perete: 'A', d: 0, h: 0 });
  const peA = corp(2, 'Pe A', { W: 900, H: 720, D: 560 }, { perete: 'A', d: 900, h: 0 });
  const peB = corp(3, 'Pe B', { W: 600, H: 720, D: 560 }, { perete: 'B', d: 900, h: 0 });

  const asezari = [colt, peA, peB].map(c => A.asezare(c, A.citestePozitie(c), cam));
  const g = A.goluri(asezari, cam);

  assert.deepEqual(g, [], 'colțul ține primii 900 mm de pe peretele B: ' + JSON.stringify(g));
});

test('peretele următor se ia în ordinea A → B → C → D', () => {
  assert.equal(A.peretUrmator('A'), 'B');
  assert.equal(A.peretUrmator('B'), 'C');
  assert.equal(A.peretUrmator('D'), 'A');
});

test('peretele plin nu are goluri', () => {
  const cam = A.camera({ A: 1400, B: 2000, H: 2500 });
  const corpuri = [corp(1, 'Unu', { W: 800, H: 720, D: 560 }), corp(2, 'Doi', { W: 600, H: 720, D: 560 })];
  const r = A.alipeste(corpuri, cam, 'A', 0);
  const asezari = corpuri.map((c, i) => A.asezare(c, r.pozitii[i], cam));
  assert.deepEqual(A.goluri(asezari, cam), []);
});

/* ---------------- ansamblul complet ---------------- */

test('ansamblul strânge pereții, problemele și desenul', () => {
  const corpuri = [
    corp(1, 'Colț', { tip: 'colt-L', W: 900, W2: 900, H: 720, D: 560 }, { perete: 'A', d: 0, h: 0 }),
    corp(2, 'Bază', { W: 800, H: 720, D: 560 }, { perete: 'A', d: 900, h: 0 }),
    corp(3, 'Suspendat', { W: 800, H: 720, D: 320 }, { perete: 'A', d: 900, h: 1400 })
  ];
  const r = A.ansamblu(comanda(), corpuri);

  assert.equal(r.camera.A, 3200);
  assert.equal(r.asezari.length, 3);
  assert.deepEqual(r.probleme, []);

  const pA = r.pereti.find(p => p.id === 'A');
  assert.equal(pA.corpuri.length, 3);
  assert.equal(pA.ocupatJos, 1700);
  assert.equal(pA.ocupatSus, 800);

  assert.match(r.plan, /^<svg /);
  assert.equal((r.plan.match(/class="an-corp/g) || []).length, 3);
});

test('elevația desenează doar corpurile peretelui cerut', () => {
  const corpuri = [
    corp(1, 'Pe A', { W: 800, H: 720, D: 560 }, { perete: 'A', d: 0, h: 0 }),
    corp(2, 'Pe B', { W: 600, H: 720, D: 560 }, { perete: 'B', d: 0, h: 0 })
  ];
  const cam = A.camera();
  const asezari = corpuri.map(c => A.asezare(c, A.citestePozitie(c), cam));

  const elA = A.elevatie(asezari, cam, 'A');
  assert.equal((elA.match(/class="an-fata/g) || []).length, 1);
  const elB = A.elevatie(asezari, cam, 'B');
  assert.equal((elB.match(/class="an-fata/g) || []).length, 1);
});

test('corpul de colț: gabaritul în plan ține tot colțul, adâncimea reală e a brațelor', () => {
  const jos = A.gabarit(Object.assign(defaults(), { tip: 'colt-L', W: 900, W2: 900, D: 560 }));
  assert.equal(jos.latime, 900);
  assert.equal(jos.adancime, 900, 'în plan ocupă tot colțul');
  assert.equal(jos.adancimeReala, 560, 'dar iese din perete doar cât brațul');
  assert.equal(jos.colt, true);

  /* un colț suspendat are brațe subțiri: după asta se știe că merge sus */
  const sus = A.gabarit(Object.assign(defaults(), { tip: 'colt-L', W: 600, W2: 600, D: 320 }));
  assert.equal(sus.adancime, 600);
  assert.equal(sus.adancimeReala, 320);
  assert.ok(sus.adancimeReala < 450 && jos.adancimeReala >= 450,
    'pragul de 450 mm trebuie să separe colțul suspendat de cel de jos');
});

test('corpul atipic își ia gabaritul din contur', () => {
  const c = corp(1, 'Sub scară', {
    tip: 'atipic', D: 560,
    contur: [{ lung: 900, unghi: 90 }, { lung: 400, unghi: 114 },
             { lung: 985, unghi: 66 }, { lung: 800, unghi: 90 }]
  });
  const g = A.gabarit(c.params);
  assert.equal(g.latime, 900);
  assert.ok(Math.abs(A.inaltimeCorp(c.params) - 800) < 2);
});
