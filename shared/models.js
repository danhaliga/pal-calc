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

  /* Categoriile carora li se poate pune soclu din setari.

     Nu e acelasi lucru cu „sta pe podea": un corp de colt sta si el pe
     podea, dar motorul nu stie sa-i puna soclu — acolo lateralele nu merg
     drept in jos. La fel la cele atipice, unde forma vine din contur.
     Categoria „sus" lipseste din alt motiv: alea atarna pe perete, si un
     soclu acolo ar fi o bucata de PAL taiata degeaba.

     Colturile pe podea raman de facut: cer lucru in ramura de colt din
     calc.js, care isi taie singura piesele. */
  var PE_PODEA = ['bucatarie-jos', 'bucatarie-inalt', 'living', 'baie'];

  var CATEGORIES = [
    { id: 'bucatarie-jos' },
    { id: 'bucatarie-sus' },
    { id: 'bucatarie-inalt' },
    { id: 'living' },
    { id: 'baie' },
    { id: 'atipic' },
    { id: 'colt' }
  ];

  /* inaltimea unui front de sertar cand fronturile umplu toata inaltimea */
  function frontEgal(H, nSer, rm, ri) {
    return Math.round((H - 2 * rm - (nSer - 1) * ri) / nSer);
  }

  /* Piesa simplă e un model doar cât să treacă prin aceeași conductă de
     creare; în grila pe categorii n-are ce căuta, are cardul ei lângă
     corpul gol. De-aia `ascuns`. */
  var MODELS = [
    {
      id: 'piesa-simpla', cat: 'living', ascuns: true,
      set: { tip: 'piesa', W: 1200, H: 600, nUsi: 0, nPol: 0, nSer: 0 }
    },
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
      /* Corpul care stă pe podea, fără picioare: lateralele merg până jos,
         iar în față intră soclul. H e cota de la podea, deci 800 = 720 de
         corp folositor plus 80 de soclu. */
      id: 'baza-2usi-soclu', cat: 'bucatarie-jos',
      set: { W: 800, H: 800, D: 560, soclu: 80, nUsi: 2, nPol: 1 }
    },
    {
      id: 'baza-2sertare', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 0, nPol: 0,
             nSer: 2, hFront: frontEgal(720, 2, 1.5, 3), hCutie: 180 }
    },
    {
      id: 'baza-4sertare', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 0, nPol: 0,
             nSer: 4, hFront: frontEgal(720, 4, 1.5, 3), hCutie: 120 }
    },
    {
      /* Corpul îngust de umplut golul rămas la capăt de front. */
      id: 'baza-ingusta', cat: 'bucatarie-jos',
      set: { W: 200, H: 720, D: 560, nUsi: 1, nPol: 2 }
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
      id: 'sus-2usi-600', cat: 'bucatarie-sus',
      set: { W: 800, H: 600, D: 320, nUsi: 2, nPol: 1 }
    },
    {
      id: 'sus-2usi-1000', cat: 'bucatarie-sus',
      set: { W: 800, H: 1000, D: 320, nUsi: 2, nPol: 3 }
    },
    {
      id: 'sus-hota', cat: 'bucatarie-sus',
      set: { W: 600, H: 360, D: 320, nUsi: 1, nPol: 0 }
    },
    {
      id: 'sus-raft', cat: 'bucatarie-sus',
      set: { W: 800, H: 360, D: 320, nUsi: 0, nPol: 1 }
    },

    /* ---------------- bucătărie, coloane ----------------

       Corpurile înalte care stau pe podea și merg până sus. Alea cu nișă la
       mijloc — cuptor, frigider — cer lucru în motorul de calcul: acum ușile
       se pot pune numai de jos în sus, fără gol la mijloc. */
    {
      id: 'coloana-camara', cat: 'bucatarie-inalt',
      set: { W: 600, H: 2000, D: 600, soclu: 80, nUsi: 2, nPol: 5 }
    },
    {
      id: 'coloana-matura', cat: 'bucatarie-inalt',
      set: { W: 400, H: 2000, D: 600, soclu: 80, nUsi: 1, nPol: 1 }
    },
    {
      /* Usa jos, gol la mijloc pentru cuptor, usa deasupra. Nisa de 600
         incape cuptoarele obisnuite de 60; verifica totusi ce cere
         producatorul aparatului. */
      id: 'coloana-cuptor', cat: 'bucatarie-inalt',
      set: { W: 600, H: 2000, D: 600, soclu: 80, nUsi: 1, hUsi: 700, hNisa: 600, nPol: 3 }
    },
    {
      /* Aparatul sta direct pe fundul corpului, deci nu e usa dedesubt:
         golul incepe de jos si se inchide cu o usa deasupra. */
      id: 'coloana-frigider', cat: 'bucatarie-inalt',
      set: { W: 600, H: 2200, D: 600, soclu: 80, nUsi: 1, hNisa: 1780, nPol: 2 }
    },

    /* ---------------- living și dormitor ---------------- */
    {
      id: 'dulap-2usi', cat: 'living',
      set: { W: 800, H: 2000, D: 580, nUsi: 2, nPol: 4 }
    },
    {
      /* Usi glisante: nu se deschid in afara, deci merg si intr-un dormitor
         stramt, unde un canat pe balamale n-ar avea loc sa se roteasca. */
      id: 'dulap-glisant', cat: 'living',
      set: { W: 1800, H: 2400, D: 600, nUsi: 2, montaj: 'glisant', nDsp: 2, nPol: 4 }
    },
    {
      id: 'dressing-glisant', cat: 'living',
      set: { W: 2400, H: 2400, D: 600, nUsi: 3, montaj: 'glisant', nDsp: 3, nPol: 4 }
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
      /* Usile prind doar partea de jos; una din politele lui cade fix pe
         linia lor, ca sa aiba canatul de ce se inchide sus. */
      id: 'biblioteca-usi-jos', cat: 'living',
      set: { W: 800, H: 1800, D: 300, nUsi: 2, nPol: 4, hUsi: 800 }
    },
    {
      /* Etajera cu cuburi: montanții și polițele fac grila. Cu 3 montanți și
         3 polițe ies 16 cuburi, adică formatul pe care-l știe toată lumea. */
      id: 'etajera-cuburi', cat: 'living',
      set: { W: 1470, H: 1470, D: 390, nUsi: 0, nDsp: 3, nPol: 3 }
    },
    {
      id: 'bufet', cat: 'living',
      set: { W: 1600, H: 800, D: 450, nUsi: 4, nDsp: 1, nPol: 1 }
    },
    {
      /* Adânc cât un pantof pus pe lat, nu cât un dulap. */
      id: 'dulap-pantofi', cat: 'living',
      /* Fara montant, polita de 900 iese de 863 — prea lunga, se lasa. */
      set: { W: 900, H: 1000, D: 280, nUsi: 2, nDsp: 1, nPol: 3 }
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
  /* Un singur panou, văzut din față, cu muchiile cantuite îngroșate. Nu
     trece prin desenul de corp: acolo se desenează un gol interior și
     fronturi, iar o piesă n-are nici una, nici alta. */
  function sketchPiesa(p) {
    var W = Math.max(+p.W || 0, 1), H = Math.max(+p.H || 0, 1), t = +p.t || 18;
    var gros = Math.max(W, H) * 0.02;
    var o = ['<rect x="0" y="0" width="' + W + '" height="' + H + '" class="sk-corp"/>'];

    /* L1/L2 sunt muchiile lungi (sus/jos), l1/l2 cele scurte (stânga/dreapta) */
    var linie = function (x1, y1, x2, y2, cant) {
      if (cant !== 'g' && cant !== 's') return;
      o.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
             '" class="sk-cant ' + (cant === 'g' ? 'gros' : 'subtire') +
             '" stroke-width="' + (cant === 'g' ? gros : gros * 0.55) + '"/>');
    };
    linie(0, gros / 2, W, gros / 2, p.pcL1);
    linie(0, H - gros / 2, W, H - gros / 2, p.pcL2);
    linie(gros / 2, 0, gros / 2, H, p.pcl1);
    linie(W - gros / 2, 0, W - gros / 2, H, p.pcl2);

    return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (W + 2 * t) + ' ' + (H + 2 * t) +
           '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
  }

  function sketch(p) {
    if (p.tip === 'piesa') return sketchPiesa(p);
    if (p.tip === 'atipic') return sketchContur(p);
    if (p.tip && p.tip !== 'drept') return sketchColt(p);
    var W = +p.W, H = +p.H, t = +p.t;
    var rm = +p.rm, ri = +p.ri, rinc = +p.rinc;
    var nU = +p.nUsi, nS = +p.nSer, nP = +p.nPol;
    var aplicat = p.montaj === 'aplicat';
    var hF = +p.hFront;
    /* Soclul mananca din inaltimea folositoare, ca in calcul: H e cota de
       la podea. Fara asta desenul ar arata un corp mai inalt decat e. */
    var soclu = Math.max(0, +p.soclu || 0);
    var Hint = H - 2 * t - soclu, Wint = W - 2 * t;
    var usedTop = nS > 0 ? nS * (hF + ri) : 0;
    var o = [];

    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="sk-corp"/>');
    o.push('<rect x="' + t + '" y="' + t + '" width="' + Wint + '" height="' + Hint + '" class="sk-gol"/>');

    /* Soclul: fasia de jos, intre laterale. Se deseneaza mai inchis la
       culoare fiindca sta RETRAS fata de fronturi — asa se si vede in
       atelier, ca o umbra sub usi. */
    if (soclu > 0) {
      o.push('<rect x="' + t + '" y="' + (H - soclu) + '" width="' + Wint +
             '" height="' + soclu + '" class="sk-soclu"/>');
    }

    /* polițe: calc le pune de jos în sus, SVG are y în jos */
    for (var j = 1; j <= nP; j++) {
      var yc = soclu + t + (Hint - usedTop) * j / (nP + 1);
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
      var uH = (aplicat ? H - soclu - 2 * rm : Hint - 2 * rinc) - usedTop;
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
    if (p.tip === 'piesa') {
      /* Fără număr de bucăți: ar cere forme de plural în treizeci de limbi
         pentru o informație care se vede oricum în lista de piese. */
      return t_('rezumat.piesa');
    }
    if (p.tip === 'atipic') b.push(t_('rezumat.laturi', { n: (p.contur || []).length }));
    if (p.tip === 'colt-L') b.push(t_('rezumat.coltL'));
    else if (p.tip === 'colt-diagonal') b.push(t_('rezumat.coltDiagonal'));
    else if (p.tip === 'colt-orb') b.push(t_('rezumat.coltOrb'));
    if (+p.nUsi) b.push(t_('corpuri.metaUsi', { n: +p.nUsi }));
    if (+p.nSer) b.push(t_('corpuri.metaSertare', { n: +p.nSer }));
    if (+p.nPol) b.push(t_('corpuri.metaPolite', { n: +p.nPol }));
    /* Pe ce stă corpul. Numai cand are soclu: „pe picioare" e felul
       obisnuit, si scris pe fiecare card ar fi zgomot. */
    if (+p.soclu > 0) b.push(t_('rezumat.peSoclu', { h: +p.soclu }));
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

  /* Catalogul pentru grila de modele. Cele ascunse au cardul lor în pagină
     și n-au ce căuta printre corpurile pe categorii. */
  function modele(tr) {
    var t_ = PalCalc.traducator(tr);
    return MODELS.filter(function (m) { return !m.ascuns; }).map(function (m) {
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

  /* Modelul asta poate primi soclu din setarile atelierului? Gol sau
     necunoscut: NU — mai bine lipseste soclul decat sa apara unde nu
     trebuie, adica o bucata de PAL taiata degeaba si o cota gresita. */
  function staPePodea(id) {
    var m = id ? byId(String(id)) : null;
    return !!(m && PE_PODEA.indexOf(m.cat) !== -1);
  }

  return {
    PE_PODEA: PE_PODEA,
    staPePodea: staPePodea,    CATEGORIES: CATEGORIES,
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
