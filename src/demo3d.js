'use strict';
/* Bucătăria de exemplu din pagina publică a planificatorului 3D.
   ============================================================

   O cameră și câteva corpuri din catalog, așezate cum le-ar pune un atelier.
   Vizitatorul le mută cu mâna, fără cont; nimic nu se salvează. Datele au
   aceeași formă ca `/api/orders/:id/ansamblu`, deci pagina folosește exact
   planificatorul din aplicație (public/ansamblu.js).
   ============================================================ */

const PalModels = require('../shared/models');
const PalCalc = require('../shared/calc');
const PalAnsamblu = require('../shared/ansamblu');

const CAMERA = { A: 3800, B: 2800, H: 2600 };
const CULORI = { corp: '#f3ece0', front: '#b4532a' };

/* Corpurile înalte au aceeași înălțime și se termină sus odată cu
   suspendatele (1450 + 720 = 2170 mm), cum se face într-o bucătărie. */
const INALT = { H: 2170 };

/* [model, perete, distanța de la colț, înălțimea de la podea, cote schimbate] */
const BUCATARIE = [
  ['coloana-frigider', 'A', 0, 0, INALT],
  ['baza-chiuveta', 'A', 600, 0],
  ['baza-3sertare', 'A', 1400, 0],
  ['baza-cuptor', 'A', 2000, 0],
  ['baza-2usi', 'A', 2600, 0],
  ['sus-2usi', 'A', 600, 1450],
  ['sus-hota', 'A', 2000, 1810],
  ['sus-vitrina', 'A', 2600, 1450],
  ['coloana-cuptor', 'B', 600, 0, INALT]
];

function date(t) {
  const corpuri = BUCATARIE.map((r, i) => ({
    id: i + 1, poz: i + 1,
    nume: PalModels.numeCorp(r[0], t),
    params: Object.assign(PalCalc.defaults(), PalModels.paramsFor(r[0], t), r[4] || {}),
    pozitie: { perete: r[1], d: r[2], h: r[3] }
  }));
  const ans = PalAnsamblu.ansamblu({ camera: CAMERA }, corpuri, t);
  return {
    camera: ans.camera,
    corpuri: ans.asezari.map(a => {
      const c = corpuri.find(x => x.id === a.id);
      const rez = PalCalc.calc(c.params, t);
      return {
        id: a.id, nume: a.nume, nr: a.nr, perete: a.perete.id, d: a.poz.d, h: a.poz.h,
        W: a.W, D: a.D, H: a.H, colt: a.colt, W2: a.W2 || 0,
        culori: CULORI, origine: a.origine, rotatie: a.rotatie,
        piese: rez.P.map(p => ({ nume: p.nume, boxes: p.boxes }))
      };
    })
  };
}

module.exports = { date, CAMERA, BUCATARIE };
