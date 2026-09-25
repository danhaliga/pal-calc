/* ============================================================
   Catalog de modele de corpuri.

   Fiecare model este doar un set de valori pentru parametrii din calc.js -
   nimic nou in motorul de calcul. Sunt incluse numai configuratiile pe care
   motorul le poate produce corect (verificate in tests/models.test.js:
   parametri valizi, piese generate, zero avertismente).

   Se incarca si pe server (CommonJS), si in browser (window.PalModels).
   ============================================================ */
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports
    ? require('./calc')
    : root.PalCalc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalModels = api;
})(typeof self !== 'undefined' ? self : this, function (PalCalc) {
  'use strict';

  var CATEGORIES = [
    { id: 'bucatarie-jos', nume: 'Bucătărie — corpuri jos',
      descriere: 'Corpuri sub blat, înălțime uzuală 720 mm, adâncime 560 mm.' },
    { id: 'bucatarie-sus', nume: 'Bucătărie — corpuri suspendate',
      descriere: 'Corpuri de perete, adâncime 320 mm.' },
    { id: 'living', nume: 'Living și dormitor',
      descriere: 'Dulapuri, biblioteci, comode, corpuri TV.' },
    { id: 'baie', nume: 'Baie',
      descriere: 'Corpuri rezistente la umezeală, adâncimi mici.' }
  ];

  /* inaltimea unui front de sertar cand fronturile umplu toata inaltimea */
  function frontEgal(H, nSer, rm, ri) {
    return Math.round((H - 2 * rm - (nSer - 1) * ri) / nSer);
  }

  var MODELS = [
    /* ---------------- bucătărie jos ---------------- */
    {
      id: 'baza-2usi', cat: 'bucatarie-jos', nume: 'Corp bază cu 2 uși',
      descriere: 'Corpul standard de sub blat, cu o poliță interioară.',
      set: { nume: 'Corp bază 2 uși', W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 }
    },
    {
      id: 'baza-1usa', cat: 'bucatarie-jos', nume: 'Corp bază cu 1 ușă',
      descriere: 'Varianta îngustă, pentru completarea frontului.',
      set: { nume: 'Corp bază 1 ușă', W: 400, H: 720, D: 560, nUsi: 1, nPol: 1 }
    },
    {
      id: 'baza-3sertare', cat: 'bucatarie-jos', nume: 'Corp bază cu 3 sertare',
      descriere: 'Fronturi egale pe toată înălțimea, cutii pe glisiere cu bilă.',
      set: { nume: 'Corp bază 3 sertare', W: 600, H: 720, D: 560, nUsi: 0, nPol: 0,
             nSer: 3, hFront: frontEgal(720, 3, 1.5, 3), hCutie: 180 }
    },
    {
      id: 'baza-sertar-usa', cat: 'bucatarie-jos', nume: 'Corp bază cu sertar și ușă',
      descriere: 'Un sertar sus pentru tacâmuri, ușă dedesubt.',
      set: { nume: 'Corp bază sertar + ușă', W: 600, H: 720, D: 560, nUsi: 1, nPol: 1,
             nSer: 1, hFront: 150, hCutie: 110 }
    },
    {
      id: 'baza-chiuveta', cat: 'bucatarie-jos', nume: 'Corp pentru chiuvetă',
      descriere: 'Fără poliță, ca să rămână loc pentru sifon și racorduri.',
      set: { nume: 'Corp chiuvetă', W: 800, H: 720, D: 560, nUsi: 2, nPol: 0 }
    },
    {
      id: 'baza-nisa', cat: 'bucatarie-jos', nume: 'Corp nișă pentru electrocasnic',
      descriere: 'Cutie deschisă pentru cuptor sau mașină de spălat vase. Verifică nișa cerută de producător.',
      set: { nume: 'Corp nișă cuptor', W: 600, H: 720, D: 560, nUsi: 0, nPol: 0 }
    },

    /* ---------------- bucătărie suspendate ---------------- */
    {
      id: 'sus-2usi', cat: 'bucatarie-sus', nume: 'Corp suspendat cu 2 uși',
      descriere: 'Corp de perete înalt, cu două polițe.',
      set: { nume: 'Corp suspendat 2 uși', W: 800, H: 720, D: 320, nUsi: 2, nPol: 2 }
    },
    {
      id: 'sus-1usa', cat: 'bucatarie-sus', nume: 'Corp suspendat cu 1 ușă',
      descriere: 'Varianta îngustă, cu două polițe.',
      set: { nume: 'Corp suspendat 1 ușă', W: 400, H: 720, D: 320, nUsi: 1, nPol: 2 }
    },
    {
      id: 'sus-hota', cat: 'bucatarie-sus', nume: 'Corp scurt peste hotă',
      descriere: 'Corp de trecere deasupra hotei sau a frigiderului.',
      set: { nume: 'Corp peste hotă', W: 600, H: 360, D: 320, nUsi: 1, nPol: 0 }
    },
    {
      id: 'sus-raft', cat: 'bucatarie-sus', nume: 'Raft suspendat deschis',
      descriere: 'Fără uși, cu o poliță. Canturi groase pe muchiile vizibile.',
      set: { nume: 'Raft suspendat', W: 800, H: 360, D: 320, nUsi: 0, nPol: 1 }
    },

    /* ---------------- living și dormitor ---------------- */
    {
      id: 'dulap-2usi', cat: 'living', nume: 'Dulap cu 2 uși',
      descriere: 'Dulap de dormitor cu patru polițe. Peste 2000 mm, ușile au nevoie de a cincea balama, ' +
                 'așa că înălțimea e oprită aici; pentru mai mult se adaugă un antresol separat.',
      set: { nume: 'Dulap 2 uși', W: 800, H: 2000, D: 580, nUsi: 2, nPol: 4 }
    },
    {
      id: 'dulap-3usi', cat: 'living', nume: 'Dulap larg cu 3 uși',
      descriere: 'Fără polițe: la această lățime au nevoie de montant central, pe care calculul nu îl generează încă.',
      set: { nume: 'Dulap 3 uși', W: 1350, H: 2000, D: 580, nUsi: 3, nPol: 0 }
    },
    {
      id: 'biblioteca', cat: 'living', nume: 'Bibliotecă deschisă',
      descriere: 'Corp înalt fără uși, cu patru polițe.',
      set: { nume: 'Bibliotecă', W: 800, H: 1800, D: 300, nUsi: 0, nPol: 4 }
    },
    {
      id: 'comoda-4sertare', cat: 'living', nume: 'Comodă cu 4 sertare',
      descriere: 'Fronturi egale, cutii din PAL de 16 mm.',
      set: { nume: 'Comodă 4 sertare', W: 800, H: 800, D: 450, nUsi: 0, nPol: 0,
             nSer: 4, hFront: frontEgal(800, 4, 1.5, 3), hCutie: 150 }
    },
    {
      id: 'noptiera', cat: 'living', nume: 'Noptieră cu 2 sertare',
      descriere: 'Corp mic, cu două sertare egale.',
      set: { nume: 'Noptieră', W: 450, H: 450, D: 400, nUsi: 0, nPol: 0,
             nSer: 2, hFront: frontEgal(450, 2, 1.5, 3), hCutie: 160 }
    },
    {
      id: 'corp-tv', cat: 'living', nume: 'Corp TV',
      descriere: 'Corp jos și lat, cu două uși. Ușile ajung la limita de 600 mm lățime.',
      set: { nume: 'Corp TV', W: 1200, H: 400, D: 400, nUsi: 2, nPol: 0 }
    },

    /* ---------------- baie ---------------- */
    {
      id: 'baie-lavoar', cat: 'baie', nume: 'Corp sub lavoar',
      descriere: 'Fără poliță, pentru sifon. Spate PFL aplicat.',
      set: { nume: 'Corp sub lavoar', W: 600, H: 500, D: 450, nUsi: 2, nPol: 0 }
    },
    {
      id: 'baie-coloana', cat: 'baie', nume: 'Coloană de baie',
      descriere: 'Corp înalt și îngust, cu patru polițe și o ușă.',
      set: { nume: 'Coloană baie', W: 400, H: 1800, D: 300, nUsi: 1, nPol: 4 }
    }
  ];

  function byId(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i];
    return null;
  }

  /* parametrii compleți ai unui model: valorile implicite + ce schimbă modelul */
  function paramsFor(id) {
    var m = byId(id);
    if (!m) return null;
    return Object.assign(PalCalc.defaults(), m.set);
  }

  /* Schita frontala a corpului, in SVG (unitati = mm).
     Deseneaza carcasa, sertarele de sus in jos, usile sub ele si politele. */
  function sketch(p) {
    var W = +p.W, H = +p.H, t = +p.t;
    var rm = +p.rm, ri = +p.ri, rinc = +p.rinc;
    var nU = +p.nUsi, nS = +p.nSer, nP = +p.nPol;
    var aplicat = p.montaj === 'aplicat';
    var hF = +p.hFront;
    var Hint = H - 2 * t, Wint = W - 2 * t;
    var usedTop = nS > 0 ? nS * (hF + ri) : 0;
    var o = [];

    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="sk-corp"/>');
    o.push('<rect x="' + t + '" y="' + t + '" width="' + Wint + '" height="' + Hint + '" class="sk-gol"/>');

    /* polițe: calc le pune de jos în sus, SVG are y în jos */
    for (var j = 1; j <= nP; j++) {
      var yc = t + (Hint - usedTop) * j / (nP + 1);
      var y = H - yc;
      o.push('<line x1="' + t + '" y1="' + y + '" x2="' + (W - t) + '" y2="' + y + '" class="sk-polita"/>');
    }

    var xoff = aplicat ? rm : t + rinc;
    var fL = aplicat ? W - 2 * rm : Wint - 2 * rinc;
    var yTop = aplicat ? rm : t + rinc;

    /* sertare, de sus în jos */
    for (var i = 0; i < nS; i++) {
      o.push('<rect x="' + xoff + '" y="' + (yTop + i * (hF + ri)) + '" width="' + fL +
             '" height="' + hF + '" class="sk-front"/>');
      var ym = yTop + i * (hF + ri) + hF / 2;
      o.push('<line x1="' + (xoff + fL / 2 - fL * 0.16) + '" y1="' + ym +
             '" x2="' + (xoff + fL / 2 + fL * 0.16) + '" y2="' + ym + '" class="sk-maner"/>');
    }

    /* uși, sub sertare */
    if (nU > 0) {
      var uH = (aplicat ? H - 2 * rm : Hint - 2 * rinc) - usedTop;
      var uL = (fL - (nU - 1) * ri) / nU;
      var yU = yTop + usedTop;
      for (var k = 0; k < nU; k++) {
        var x = xoff + k * (uL + ri);
        o.push('<rect x="' + x + '" y="' + yU + '" width="' + uL + '" height="' + uH + '" class="sk-front"/>');
        /* mâner pe muchia dinspre mijloc */
        var xm = nU > 1 && k === 0 ? x + uL - uL * 0.12 : x + uL * 0.12;
        o.push('<line x1="' + xm + '" y1="' + (yU + uH * 0.42) + '" x2="' + xm +
               '" y2="' + (yU + uH * 0.58) + '" class="sk-maner"/>');
      }
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'role="img" aria-label="Schiță ' + W + ' pe ' + H + ' mm">' + o.join('') + '</svg>';
  }

  /* rezumat scurt pentru cardul din catalog */
  function rezumat(p) {
    var b = [];
    if (+p.nUsi) b.push(+p.nUsi + (+p.nUsi === 1 ? ' ușă' : ' uși'));
    if (+p.nSer) b.push(+p.nSer + (+p.nSer === 1 ? ' sertar' : ' sertare'));
    if (+p.nPol) b.push(+p.nPol + (+p.nPol === 1 ? ' poliță' : ' polițe'));
    if (!b.length) b.push('corp deschis');
    return b.join(' · ');
  }

  return {
    CATEGORIES: CATEGORIES,
    MODELS: MODELS,
    byId: byId,
    paramsFor: paramsFor,
    sketch: sketch,
    rezumat: rezumat
  };
});
