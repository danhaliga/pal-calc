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
    { id: 'bucatarie-jos' },
    { id: 'bucatarie-sus' },
    { id: 'living' },
    { id: 'baie' },
    { id: 'atipic' },
    { id: 'colt' }
  ];

  /* inaltimea unui front de sertar cand fronturile umplu toata inaltimea */
  function frontEgal(H, nSer, rm, ri) {
    return Math.round((H - 2 * rm - (nSer - 1) * ri) / nSer);
  }

  var MODELS = [
    /* ---------------- bucătărie jos ---------------- */
    {
      id: 'baza-2usi', cat: 'bucatarie-jos',
      set: { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 }
    },
    {
      id: 'baza-1usa', cat: 'bucatarie-jos',
      set: { W: 400, H: 720, D: 560, nUsi: 1, nPol: 1 }
    },
    {
      id: 'baza-3sertare', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 0, nPol: 0,
             nSer: 3, hFront: frontEgal(720, 3, 1.5, 3), hCutie: 180 }
    },
    {
      id: 'baza-sertar-usa', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 1, nPol: 1,
             nSer: 1, hFront: 150, hCutie: 110 }
    },
    {
      id: 'baza-chiuveta', cat: 'bucatarie-jos',
      set: { W: 800, H: 720, D: 560, nUsi: 2, nPol: 0 }
    },
    {
      id: 'baza-nisa', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 0, nPol: 0 }
    },

    /* ---------------- bucătărie suspendate ---------------- */
    {
      id: 'sus-2usi', cat: 'bucatarie-sus',
      set: { W: 800, H: 720, D: 320, nUsi: 2, nPol: 2 }
    },
    {
      id: 'sus-1usa', cat: 'bucatarie-sus',
      set: { W: 400, H: 720, D: 320, nUsi: 1, nPol: 2 }
    },
    {
      id: 'sus-hota', cat: 'bucatarie-sus',
      set: { W: 600, H: 360, D: 320, nUsi: 1, nPol: 0 }
    },
    {
      id: 'sus-raft', cat: 'bucatarie-sus',
      set: { W: 800, H: 360, D: 320, nUsi: 0, nPol: 1 }
    },

    /* ---------------- living și dormitor ---------------- */
    {
      id: 'dulap-2usi', cat: 'living',
      set: { W: 800, H: 2000, D: 580, nUsi: 2, nPol: 4 }
    },
    {
      id: 'dulap-3usi', cat: 'living',
      set: { W: 1350, H: 2000, D: 580, nUsi: 3, nPol: 0 }
    },
    {
      id: 'biblioteca', cat: 'living',
      set: { W: 800, H: 1800, D: 300, nUsi: 0, nPol: 4 }
    },
    {
      id: 'comoda-4sertare', cat: 'living',
      set: { W: 800, H: 800, D: 450, nUsi: 0, nPol: 0,
             nSer: 4, hFront: frontEgal(800, 4, 1.5, 3), hCutie: 150 }
    },
    {
      id: 'noptiera', cat: 'living',
      set: { W: 450, H: 450, D: 400, nUsi: 0, nPol: 0,
             nSer: 2, hFront: frontEgal(450, 2, 1.5, 3), hCutie: 160 }
    },
    {
      id: 'corp-tv', cat: 'living',
      set: { W: 1200, H: 400, D: 400, nUsi: 2, nPol: 0 }
    },

    /* ---------------- baie ---------------- */
    {
      id: 'baie-lavoar', cat: 'baie',
      set: { W: 600, H: 500, D: 450, nUsi: 2, nPol: 0 }
    },
    {
      id: 'baie-coloana', cat: 'baie',
      set: { W: 400, H: 1800, D: 300, nUsi: 1, nPol: 4 }
    },

    /* ---------------- corpuri de colț ---------------- */
    {
      id: 'colt-jos-L', cat: 'colt',
      set: { tip: 'colt-L', W: 900, W2: 900, H: 720, D: 560,
             nUsi: 2, nPol: 0, nSer: 0 }
    },
    {
      id: 'colt-jos-diagonal', cat: 'colt',
      set: { tip: 'colt-diagonal', W: 900, W2: 900, H: 720, D: 560,
             nUsi: 1, nPol: 0, nSer: 0 }
    },
    {
      id: 'colt-jos-orb', cat: 'colt',
      set: { tip: 'colt-orb', W: 1000, H: 720, D: 560, orb: 550,
             nUsi: 1, nPol: 0, nSer: 0 }
    },
    {
      id: 'colt-sus-L', cat: 'colt',
      set: { tip: 'colt-L', W: 600, W2: 600, H: 720, D: 320,
             nUsi: 2, nPol: 2, nSer: 0 }
    },
    {
      id: 'colt-sus-diagonal', cat: 'colt',
      set: { tip: 'colt-diagonal', W: 600, W2: 600, H: 720, D: 320,
             nUsi: 1, nPol: 2, nSer: 0 }
    },
    {
      id: 'colt-living-deschis', cat: 'colt',
      set: { tip: 'colt-L', W: 800, W2: 800, H: 1800, D: 300,
             nUsi: 0, nPol: 4, nSer: 0 }
    },
    {
      id: 'colt-baie', cat: 'colt',
      set: { tip: 'colt-diagonal', W: 500, W2: 500, H: 500, D: 300,
             nUsi: 1, nPol: 1, nSer: 0 }
    },
    /* ---------------- corpuri atipice ---------------- */
    {
      id: 'atipic-sub-scara', cat: 'atipic',
      set: { tip: 'atipic', D: 560, nUsi: 1, nPol: 0, nSer: 0,
             contur: [{ lung: 900, unghi: 90 }, { lung: 400, unghi: 114 },
                      { lung: 985, unghi: 66 }, { lung: 800, unghi: 90 }] }
    },
    {
      id: 'atipic-mansarda', cat: 'atipic',
      set: { tip: 'atipic', D: 450, nUsi: 1, nPol: 0, nSer: 0,
             contur: [{ lung: 1200, unghi: 90 }, { lung: 700, unghi: 135 },
                      { lung: 566, unghi: 135 }, { lung: 800, unghi: 90 },
                      { lung: 1100, unghi: 90 }] }
    },
    {
      id: 'atipic-liber', cat: 'atipic',
      set: { tip: 'atipic', D: 560, nUsi: 0, nPol: 0, nSer: 0,
             contur: [{ lung: 800, unghi: 90 }, { lung: 720, unghi: 90 },
                      { lung: 800, unghi: 90 }, { lung: 720, unghi: 90 }] }
    },

    {
      id: 'colt-dressing', cat: 'colt',
      set: { tip: 'colt-L', W: 800, W2: 800, H: 2000, D: 560,
             nUsi: 2, nPol: 3, nSer: 0 }
    }
  ];

  function byId(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i].id === id) return MODELS[i];
    return null;
  }

  /* parametrii compleți ai unui model: valorile implicite + ce schimbă modelul */
  function paramsFor(id, tr) {
    var m = byId(id);
    if (!m) return null;
    var p = Object.assign(PalCalc.defaults(tr), m.set);
    p.nume = numeCorp(id, tr);
    return p;
  }

  /* Schita unui corp atipic: chiar conturul lui, vazut din fata. */
  function sketchContur(p) {
    var g = PalCalc.conturGeometrie(p.contur || []);
    if (!g.puncte.length) return '<svg viewBox="0 0 10 10" class="sk"></svg>';
    var W = Math.max(g.W, 10), H = Math.max(g.H, 10);
    var t = +p.t || 18;
    var o = [];
    o.push('<polygon points="' + g.puncte.map(function (q) {
      return q[0] + ',' + (H - q[1]);
    }).join(' ') + '" class="sk-corp"/>');
    if (+p.nUsi > 0) {
      o.push('<polygon points="' + g.puncte.map(function (q) {
        return (q[0] * 0.88 + W * 0.06) + ',' + (H - (q[1] * 0.88 + H * 0.06));
      }).join(' ') + '" class="sk-front"/>');
    }
    return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (W + 2 * t) + ' ' + (H + 2 * t) +
           '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
  }

  /* Schita in plan pentru corpurile de colt: acolo vederea frontala nu spune nimic. */
  function sketchColt(p) {
    var A = +p.W, B = +p.W2, D = +p.D, t = +p.t, rm = +p.rm;
    var dg = p.tip === 'colt-diagonal';
    var o = [];

    if (p.tip === 'colt-orb') {
      var orb = +p.orb;
      o.push('<rect x="0" y="0" width="' + A + '" height="' + D + '" class="sk-corp"/>');
      o.push('<rect x="' + (A - orb) + '" y="0" width="' + orb + '" height="' + D + '" class="sk-orb"/>');
      o.push('<line x1="' + rm + '" y1="' + (D - t / 2) + '" x2="' + (A - orb - rm) +
             '" y2="' + (D - t / 2) + '" class="sk-usa"/>');
      return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (A + 2 * t) + ' ' + (D + 2 * t) +
             '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
             'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
    }

    var pts = dg
      ? [[0, 0], [A, 0], [A, D], [D, B], [0, B]]
      : [[0, 0], [A, 0], [A, D], [D, D], [D, B], [0, B]];
    o.push('<polygon points="' + pts.map(function (q) { return q.join(','); }).join(' ') + '" class="sk-corp"/>');

    if (+p.nUsi > 0) {
      if (dg) {
        o.push('<line x1="' + A + '" y1="' + D + '" x2="' + D + '" y2="' + B + '" class="sk-usa"/>');
      } else {
        o.push('<line x1="' + D + '" y1="' + D + '" x2="' + A + '" y2="' + D + '" class="sk-usa"/>');
        o.push('<line x1="' + D + '" y1="' + D + '" x2="' + D + '" y2="' + B + '" class="sk-usa"/>');
      }
    }
    /* pereții */
    o.push('<line x1="0" y1="0" x2="' + A + '" y2="0" class="sk-perete"/>');
    o.push('<line x1="0" y1="0" x2="0" y2="' + B + '" class="sk-perete"/>');

    return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (A + 2 * t) + ' ' + (B + 2 * t) +
           '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
  }

  /* Schita frontala a corpului, in SVG (unitati = mm).
     Deseneaza carcasa, sertarele de sus in jos, usile sub ele si politele. */
  function sketch(p) {
    if (p.tip === 'atipic') return sketchContur(p);
    if (p.tip && p.tip !== 'drept') return sketchColt(p);
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
           'aria-hidden="true" focusable="false">' + o.join('') + '</svg>';
  }

  /* rezumat scurt pentru cardul din catalog */
  function rezumat(p, tr) {
    var t_ = PalCalc.traducator(tr);
    var b = [];
    if (p.tip === 'atipic') b.push(t_('rezumat.laturi', { n: (p.contur || []).length }));
    if (p.tip === 'colt-L') b.push(t_('rezumat.coltL'));
    else if (p.tip === 'colt-diagonal') b.push(t_('rezumat.coltDiagonal'));
    else if (p.tip === 'colt-orb') b.push(t_('rezumat.coltOrb'));
    if (+p.nUsi) b.push(t_('corpuri.metaUsi', { n: +p.nUsi }));
    if (+p.nSer) b.push(t_('corpuri.metaSertare', { n: +p.nSer }));
    if (+p.nPol) b.push(t_('corpuri.metaPolite', { n: +p.nPol }));
    if (!b.length) b.push(t_('rezumat.corpDeschis'));
    return b.join(' · ');
  }

  /* Catalogul cu numele scrise în limba cerută. */
  function categorii(tr) {
    var t_ = PalCalc.traducator(tr);
    return CATEGORIES.map(function (c) {
      return { id: c.id, nume: t_('modele.cat.' + c.id + '.nume'),
               descriere: t_('modele.cat.' + c.id + '.descriere') };
    });
  }

  function modele(tr) {
    var t_ = PalCalc.traducator(tr);
    return MODELS.map(function (m) {
      return Object.assign({}, m, {
        nume: t_('modele.m.' + m.id + '.nume'),
        descriere: t_('modele.m.' + m.id + '.descriere')
      });
    });
  }

  /* Numele cu care se salvează un corp creat din acest model. */
  function numeCorp(id, tr) {
    return PalCalc.traducator(tr)('modele.m.' + id + '.corpNume');
  }

  return {
    CATEGORIES: CATEGORIES,
    MODELS: MODELS,
    categorii: categorii,
    modele: modele,
    numeCorp: numeCorp,
    byId: byId,
    paramsFor: paramsFor,
    sketch: sketch,
    rezumat: rezumat
  };
});
