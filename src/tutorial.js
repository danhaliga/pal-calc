'use strict';
/* „Cum funcționează": fiecare setare a corpului, arătată pe corp.
   ============================================================

   O scenă pornește de la un model din catalog și schimbă, pas cu pas, câte
   o setare. Fiecare pas se calculează aici, cu motorul aplicației, ca
   desenul să fie corpul adevărat; pagina (public/tutorial.js) îl desenează
   izometric și evidențiază piesele care apar. Dacă se schimbă calculul, se
   schimbă și filmul: nu e nimic de refăcut de mână.

   Pașii se adună: fiecare pornește de la cel dinainte. `explod` desface
   corpul puțin, ca să se vadă ce e înăuntru sau în spate.
   ============================================================ */

const PalModels = require('../shared/models');
const PalCalc = require('../shared/calc');

const SCENE = [
  { id: 'dimensiuni', model: 'baza-2usi', pasi: [
    {}, { W: 1000 }, { H: 850 }, { D: 400 }
  ] },
  { id: 'usi', model: 'baza-2usi', pasi: [
    { nUsi: 0 }, { nUsi: 1 }, { nUsi: 2 }, { montaj: 'incastrat' }, { montaj: 'glisant', W: 1200 }
  ] },
  { id: 'polite', model: 'baza-2usi', pasi: [
    { faraFront: 1, nPol: 0 }, { nPol: 1 }, { nPol: 3 }
  ] },
  { id: 'montanti', model: 'baza-2usi', pasi: [
    { W: 1200, faraFront: 1, nPol: 1, nDsp: 0 }, { nDsp: 1 }, { nDsp: 2 }
  ] },
  { id: 'sertare', model: 'baza-2usi', pasi: [
    { nUsi: 0, nPol: 0, nSer: 1 }, { nSer: 2 }, { nSer: 4 }, { explod: 0.5 }
  ] },
  { id: 'spate', model: 'baza-2usi', pasi: [
    { explod: 0.55, spate: 'aplicat' }, { spate: 'nut' }, { spate: 'pal', tp: 18 }
  ] },
  { id: 'manere', model: 'baza-2usi', pasi: [
    { maner: 0 }, { maner: 1 }, { manerDir: 'orizontal' }, { manerPoz: 'sus' }
  ] },
  { id: 'soclu', model: 'baza-2usi', pasi: [
    { soclu: 0, picioare: 0 }, { soclu: 100 }, { soclu: 0, picioare: 1 }
  ] },
  { id: 'material', model: 'baza-2usi', pasi: [
    { t: 18 }, { t: 25 }, { cg: 0.8 }
  ] },
  { id: 'sticla', model: 'sus-vitrina', pasi: [
    { usiSticla: 0 }, { usiSticla: 1 }
  ] },
  { id: 'colt', model: 'colt-jos-L', pasi: [
    {}, { W: 1100 }, { W2: 1100 }
  ] },
  { id: 'subscara', model: 'atipic-sub-scara', pasi: [
    {}, { capatLaterala: 'inclinat' }, { nPol: 2 }
  ] },
  { id: 'piesa', model: 'piesa-simpla', pasi: [
    {}, { pieseExtra: [{ nume: '', L: 720, l: 100, buc: 2, cL1: 'g', cL2: '-', cl1: '-', cl2: '-', fibra: 'L' }] },
    { pieseExtra: [{ nume: '', L: 720, l: 100, buc: 2, cL1: 'g', cL2: '-', cl1: '-', cl2: '-', fibra: 'L' },
                   { nume: '', L: 500, l: 300, buc: 1, cL1: 'g', cL2: 'g', cl1: '-', cl2: '-', fibra: 'L' }] }
  ] }
];

const r1 = v => Math.round(v * 10) / 10;

function material(p, b) {
  if (b.grp === 'fronturi') return 'front';
  if (b.grp === 'spate') return 'pfl';
  if (p && /Fund$/.test(p.cheie) && b.grp === 'sertare') return 'pfl';
  return 'pal';
}

/* Fețele unei piese, în coordonatele corpului: cutie (6 fețe), contur în
   plan ridicat pe grosime (blatul, fundul și polița de colț) sau contur din
   față împins pe adâncime (lateralele și tavanul de sub scară). Aceleași
   convenții ca vederea 3D din editor (public/app.js). */
function fete(b) {
  const prisma = (jos, sus) => {
    const n = jos.length;
    const f = [jos.slice().reverse(), sus.slice()];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f.push([jos[i], jos[j], sus[j], sus[i]]);
    }
    return f;
  };
  if (b.poly) {
    return prisma(b.poly.map(q => [b.x + q[0], b.y, b.z + q[1]]),
                  b.poly.map(q => [b.x + q[0], b.y + b.sy, b.z + q[1]]));
  }
  if (b.polyFata) {
    return prisma(b.polyFata.map(q => [q[0], q[1], b.z]),
                  b.polyFata.map(q => [q[0], q[1], b.z + b.sz]));
  }
  const X = [b.x, b.x + b.sx], Y = [b.y, b.y + b.sy], Z = [b.z, b.z + b.sz];
  const c = (i, j, k) => [X[i], Y[j], Z[k]];
  return [
    [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], [c(1, 0, 0), c(1, 0, 1), c(1, 1, 1), c(1, 1, 0)],
    [c(0, 0, 0), c(0, 0, 1), c(1, 0, 1), c(1, 0, 0)], [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], [c(0, 0, 1), c(0, 1, 1), c(1, 1, 1), c(1, 0, 1)]
  ];
}

/* Un cadru: piesele desenului (fețe, cu o cheie stabilă pe piesă, ca
   pagina să știe ce e nou), primele rânduri din lista de debitare și cotele. */
function cadru(params, t) {
  const r = PalCalc.calc(params, t);
  const piese = [];
  const vazute = {};
  const adauga = (k, b, mat) => {
    if (b.ry || b.rz) return;
    piese.push({ k, mat, ex: b.ex || [0, 0, 0],
                 f: fete(b).map(fata => fata.map(q => q.map(r1))) });
  };
  r.P.forEach(p => (p.boxes || []).forEach(b => {
    adauga(p.cheie + ':' + (vazute[p.cheie] = (vazute[p.cheie] || 0) + 1), b, material(p, b));
  }));
  (r.sticla3d || []).forEach((b, i) => adauga('sticla:' + i, b, 'sticla'));
  (r.manere || []).forEach((b, i) => adauga('maner:' + i, b, 'maner'));
  return {
    piese,
    W: params.W, H: params.H, D: params.D,
    cote: r1(params.W) + ' × ' + r1(params.H) + ' × ' + r1(params.D) + ' mm',
    debitare: r.P.slice(0, 6).map(p => ({ nume: p.nume, buc: p.buc, cote: r1(p.L) + ' × ' + r1(p.l), taiere: r1(p.TL) + ' × ' + r1(p.Tl) })),
    nrPiese: r.P.reduce((s, p) => s + p.buc, 0)
  };
}

function date(t) {
  return {
    scene: SCENE.map(s => {
      let params = Object.assign(PalCalc.defaults(), PalModels.paramsFor(s.model, t));
      let explod = 0;
      return {
        id: s.id,
        titlu: t('tutorial.' + s.id + '.titlu'),
        pasi: s.pasi.map((schimbari, i) => {
          const sch = Object.assign({}, schimbari);
          if (sch.explod != null) { explod = sch.explod; delete sch.explod; }
          params = Object.assign({}, params, sch);
          return Object.assign(cadru(params, t), { explod, text: t('tutorial.' + s.id + '.pas' + (i + 1)) });
        })
      };
    })
  };
}

module.exports = { date, SCENE };
