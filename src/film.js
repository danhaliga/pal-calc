'use strict';
/* „Filmul" de pe pagina de prezentare.
   ============================================================

   Câteva corpuri din catalog, desenate izometric, care se desfac piesă cu
   piesă, cu lista de debitare, planșa CNC a lateralei și pașii de montaj
   alături. Nimic nu e scris de mână: corpurile se calculează aici, cu
   același motor ca lucrările din atelier, în limba celui care se uită.
   Browserul (public/film.js) doar le desenează.
   ============================================================ */

const PalModels = require('../shared/models');
const PalCalc = require('../shared/calc');

const MODELE = ['baza-2usi', 'baza-3sertare', 'dulap-2usi', 'sus-vitrina'];

const r1 = v => Math.round(v * 10) / 10;

/* Materialul unei cutii din desen: după grupa ei din vederea 3D. */
function material(p, b) {
  if (b.grp === 'fronturi') return 'front';
  if (b.grp === 'spate') return 'pfl';
  if (p && /Fund$/.test(p.cheie) && b.grp === 'sertare') return 'pfl';
  return 'pal';
}

const cutie = (b, mat) => ({ x: r1(b.x), y: r1(b.y), z: r1(b.z), sx: r1(b.sx), sy: r1(b.sy), sz: r1(b.sz), ex: b.ex || [0, 0, 0], mat });

function unCorp(id, t) {
  const params = PalModels.paramsFor(id, t);
  const r = PalCalc.calc(params, t);
  const cutii = [];
  r.P.forEach(p => (p.boxes || []).forEach(b => {
    /* desenul știe doar cutii drepte; piesele cu contur nu intră aici */
    if (b.poly || b.polyFata || b.ry || b.rz) return;
    cutii.push(cutie(b, material(p, b)));
  }));
  (r.sticla3d || []).forEach(b => { if (!b.ry && !b.rz) cutii.push(cutie(b, 'sticla')); });
  (r.manere || []).forEach(b => cutii.push(cutie(b, 'maner')));

  const lat = r.P.find(p => p.cheie === 'laterala');
  const sertare = +params.nSer > 0;
  const usi = +params.nUsi > 0 || (r.sticla3d || []).length > 0;

  const montaj = ['landing.film.montajCarcasa'];
  if (+params.nPol > 0) montaj.push('landing.film.montajPolite');
  if (sertare) montaj.push('landing.film.montajGlisiere', 'landing.film.montajSertare');
  montaj.push('landing.film.montajSpate');
  if ((r.sticla3d || []).length) montaj.push('landing.film.montajSticla');
  else if (usi) montaj.push('landing.film.montajUsi');

  return {
    nume: PalModels.numeCorp(id, t),
    cote: params.W + ' × ' + params.H + ' × ' + params.D + ' mm',
    W: params.W, H: params.H, D: params.D,
    cutii,
    debitare: r.P.slice(0, 5).map(p => ({ nume: p.nume, buc: p.buc, cote: r1(p.L) + ' × ' + r1(p.l) })),
    cnc: lat ? {
      piesa: lat.nume, L: r1(lat.L), l: r1(lat.l),
      balamale: usi ? PalCalc.balamale(params.H) : 0,
      polite: +params.nPol > 0, sertare,
      nota: t(sertare ? 'landing.film.cncGlisiere' : 'landing.film.cncBalamale')
    } : null,
    montaj: montaj.slice(0, 4).map(k => t(k))
  };
}

function date(t) {
  return { corpuri: MODELE.map(id => unCorp(id, t)) };
}

module.exports = { date, MODELE };
