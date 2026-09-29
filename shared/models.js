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

     Categoria „sus" lipseste: alea atarna pe perete, si un soclu acolo ar
     fi o bucata de PAL taiata degeaba. Lipsesc si cele atipice, unde forma
     vine din contur si n-au laterale drepte pana jos.

     Colturile nu se pot lua pe categorie: in „colt" stau si cele de jos, si
     cele suspendate. Cele care stau pe podea au `podea: true` pe model. */
  var PE_PODEA = ['bucatarie-jos', 'bucatarie-inalt', 'living', 'baie'];

  /* Categoriile care vin pe picioare cu plintă de aluminiu: bucătăria.
     Un corp singur pe podea se face cu soclu din PAL — vezi `soclu`. */
  var PE_PICIOARE = ['bucatarie-jos', 'bucatarie-inalt'];

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
      /* Cargoul glisant umple corpul pe toată înălțimea, deci n-are poliță.
         Frontul se prinde de cadrul cargoului, nu de balamale — dar în
         lista de debitare tot o ușă e, cu aceleași cote. */
      id: 'baza-jolly', cat: 'bucatarie-jos',
      set: { W: 300, H: 720, D: 560, nUsi: 1, nPol: 0, jolly: 1 }
    },
    {
      /* Coșurile Jolly se vând pentru corpuri de 150, 200 și 300. */
      id: 'baza-jolly-200', cat: 'bucatarie-jos',
      set: { W: 200, H: 720, D: 560, nUsi: 1, nPol: 0, jolly: 1 }
    },
    {
      id: 'baza-jolly-150', cat: 'bucatarie-jos',
      set: { W: 150, H: 720, D: 560, nUsi: 1, nPol: 0, jolly: 1 }
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
    {
      /* Cuptor sub blat, sertar dedesubt. Fără uși: fața de sus e a
         cuptorului. Polița (singura) e cea pe care stă aparatul, deasupra
         sertarului. Nișa de 600 încape cuptoarele obișnuite de 60; verifică
         totuși ce cere producătorul. Cu front de 100, cutia sertarului
         poate avea cel mult 64 — se pune 60, ca să rămână un joc. */
      id: 'baza-cuptor', cat: 'bucatarie-jos',
      set: { W: 600, H: 720, D: 560, nUsi: 0, nPol: 1,
             nSer: 1, sertareJos: 1, hFront: 100, hCutie: 60, hNisa: 600 }
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
      /* Vitrina: uși cu ramă de aluminiu și sticlă, cumpărate gata la cotă.
         Din PAL se taie doar corpul și polițele. */
      id: 'sus-vitrina', cat: 'bucatarie-sus',
      set: { W: 800, H: 720, D: 320, nUsi: 2, nPol: 2, usiSticla: 1 }
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
      id: 'vitrina', cat: 'living',
      set: { W: 800, H: 1800, D: 400, nUsi: 2, nPol: 4, usiSticla: 1 }
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
      id: 'colt-jos-L', cat: 'colt', podea: true,
      set: { tip: 'colt-L', W: 900, W2: 900, H: 720, D: 560,
             nUsi: 2, nPol: 0, nSer: 0 }
    },
    {
      id: 'colt-jos-diagonal', cat: 'colt', podea: true,
      set: { tip: 'colt-diagonal', W: 900, W2: 900, H: 720, D: 560,
             nUsi: 1, nPol: 0, nSer: 0 }
    },
    {
      id: 'colt-jos-orb', cat: 'colt', podea: true,
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
      id: 'colt-living-deschis', cat: 'colt', podea: true,
      set: { tip: 'colt-L', W: 800, W2: 800, H: 1800, D: 300,
             nUsi: 0, nPol: 4, nSer: 0 }
    },
    {
      id: 'colt-baie', cat: 'colt', podea: true,
      set: { tip: 'colt-diagonal', W: 500, W2: 500, H: 500, D: 300,
             nUsi: 1, nPol: 1, nSer: 0 }
    },
    /* ---------------- corpuri atipice ---------------- */
    {
      /* Conturul se socotește din cele trei cote — bază 900, dreapta 400,
         stânga 800 — nu se scrie de mână. Scris de mână, cu unghiurile
         rotunjite la grad, rămânea 0.2 mm în colț: nu se vedea pe desen, dar
         muchia din stânga ieșea din dreptunghiul de gabarit și lista CNC
         cerea o frezare pe o latură care e dreaptă. */
      id: 'atipic-sub-scara', cat: 'atipic',
      set: { tip: 'atipic', D: 560, nUsi: 1, nPol: 0, nSer: 0,
             contur: PalCalc.conturSubScara(900, 400, 800) }
    },
    {
      /* Scris din colțuri, nu din unghiuri: jos 1200, în dreapta se urcă 700,
         de acolo o pantă de 45° până la 1100, apoi 800 pe orizontală sub
         tavan și înapoi jos pe stânga. Panta e 400√2 = 565.685, iar rotunjită
         la 566 — cum era scrisă de mână — conturul rămânea cu două zecimi în
         colț și lista CNC cerea o frezare pe latura din stânga, care e
         dreaptă. */
      id: 'atipic-mansarda', cat: 'atipic',
      set: { tip: 'atipic', D: 450, nUsi: 1, nPol: 0, nSer: 0,
             contur: PalCalc.conturDinPuncte(
               [[0, 0], [1200, 0], [1200, 700], [800, 1100], [0, 1100]]) }
    },
    {
      id: 'atipic-liber', cat: 'atipic',
      set: { tip: 'atipic', D: 560, nUsi: 0, nPol: 0, nSer: 0,
             contur: [{ lung: 800, unghi: 90 }, { lung: 720, unghi: 90 },
                      { lung: 800, unghi: 90 }, { lung: 720, unghi: 90 }] }
    },

    {
      id: 'colt-dressing', cat: 'colt', podea: true,
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
    /* Corpurile de bucătărie de pe podea vin pe picioare, cu plintă de
       aluminiu în față — felul bucătăriei puse în șir. Numai bucătăria:
       la living și baie nu s-a spus așa, deci acolo se pune din editor.
       Cele cu soclu în model rămân pe soclu. */
    if (PE_PICIOARE.indexOf(m.cat) !== -1 && staPePodea(id) && !(+p.soclu > 0)) p.picioare = 1;
    if (m.cat === 'colt' && m.podea && /^colt-jos-/.test(id) && !(+p.soclu > 0)) p.picioare = 1;
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
      }).join(' ') + '" class="' + clasaFront(p) + '"/>');
    }
    return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (W + 2 * t) + ' ' + (H + 2 * t) +
           '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
  }

  /* Corpul comandat fara fronturi se deseneaza cu fronturile PUNCTATE, nu
     fara ele: golul unde vin usile se vede in atelier si trebuie sa se vada
     si pe desen. Un card fara nimic in fata ar arata ca un corp deschis,
     adica alt corp. */
  function faraFront(p) { return +p.faraFront ? ' fara' : ''; }

  function clasaFront(p) { return +p.faraFront ? 'sk-front fara' : 'sk-front'; }

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
             '" y2="' + (D - t / 2) + '" class="sk-usa' + faraFront(p) + '"/>');
      return '<svg viewBox="' + (-t) + ' ' + (-t) + ' ' + (A + 2 * t) + ' ' + (D + 2 * t) +
             '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
             'aria-hidden="true" focusable="false"><g>' + o.join('') + '</g></svg>';
    }

    var pts = dg
      ? [[0, 0], [A, 0], [A, D], [D, B], [0, B]]
      : [[0, 0], [A, 0], [A, D], [D, D], [D, B], [0, B]];
    o.push('<polygon points="' + pts.map(function (q) { return q.join(','); }).join(' ') + '" class="sk-corp"/>');

    if (+p.nUsi > 0) {
      var cu = 'sk-usa' + faraFront(p);
      if (dg) {
        o.push('<line x1="' + A + '" y1="' + D + '" x2="' + D + '" y2="' + B + '" class="' + cu + '"/>');
      } else {
        o.push('<line x1="' + D + '" y1="' + D + '" x2="' + A + '" y2="' + D + '" class="' + cu + '"/>');
        o.push('<line x1="' + D + '" y1="' + D + '" x2="' + D + '" y2="' + B + '" class="' + cu + '"/>');
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
    return sketchDinCalcul(p);
  }

  /* Schița frontală a corpului drept, FĂCUTĂ DIN CALCUL.

     Până aici schița era un desen separat, scris de mână: știa de uși și de
     sertare, dar nu de nișă, de montanți, de ușile doar jos, de sertarele
     de jos sau de sticlă. Iar pagina corpului desenează din piesele
     calculate — așa că omul alegea un card și primea alt corp decât cel
     din poză.

     Acum cardul se desenează din aceleași piese ca vederea 3D, privite din
     față: ce se schimbă în calcul se schimbă singur și pe card. */
  var FARA_NUME = function (k) { return k; };

  function sketchDinCalcul(p) {
    var faraF = !!(+p.faraFront);
    /* Fără fronturi, calculul le scoate din listă. Pe desen se văd totuși,
       punctate: golul unde vin ușile trebuie să se vadă. */
    var r = PalCalc.calc(faraF ? Object.assign({}, p, { faraFront: 0 }) : p, FARA_NUME);
    var W = r.W, H = r.H, t = +p.t || 18;
    var soclu = Math.max(0, +r.soclu || 0);
    var o = [];
    var y = function (b) { return H - (b.y + b.sy); };      /* SVG are y în jos */
    var dreptunghi = function (b, cls) {
      o.push('<rect x="' + b.x + '" y="' + y(b) + '" width="' + b.sx +
             '" height="' + b.sy + '" class="' + cls + '"/>');
    };
    var cutii = function (cheie) {
      var out = [];
      r.P.forEach(function (x) { if (x.cheie === cheie) out = out.concat(x.boxes || []); });
      return out;
    };

    /* Carcasa, apoi golul din ea. */
    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="sk-corp"/>');
    o.push('<rect x="' + t + '" y="' + (H - soclu - t - r.Hint) + '" width="' + (W - 2 * t) +
           '" height="' + r.Hint + '" class="sk-gol"/>');

    /* Soclul: mai închis la culoare, fiindcă stă retras față de fronturi. */
    cutii('soclu').forEach(function (b) { dreptunghi(b, 'sk-soclu'); });
    /* Montanții, ca niște laterale în mijloc. */
    cutii('montant').forEach(function (b) { dreptunghi(b, 'sk-corp'); });
    /* Polițele, pe linia lor adevărată — și cea pe care stă cuptorul. */
    cutii('polita').forEach(function (b) {
      var yc = H - (b.y + b.sy / 2);
      o.push('<line x1="' + b.x + '" y1="' + yc + '" x2="' + (b.x + b.sx) + '" y2="' + yc +
             '" class="sk-polita"/>');
    });

    /* Fronturile, peste tot ce e în corp. */
    var clasa = faraF ? 'sk-front fara' : 'sk-front';
    r.P.forEach(function (x) {
      if (x.rol !== 'front') return;
      (x.boxes || []).forEach(function (b) { dreptunghi(b, clasa); });
    });
    (r.sticla3d || []).forEach(function (b) { dreptunghi(b, 'sk-front sticla'); });

    /* Mânerele, ca linie pe lungimea lor. Fără fronturi nu se pun. */
    if (!faraF) {
      (r.manere || []).forEach(function (b) {
        var vert = b.sy > b.sx;
        var cx = b.x + b.sx / 2, cy = H - (b.y + b.sy / 2);
        var jum = (vert ? b.sy : b.sx) / 2;
        o.push('<line x1="' + (vert ? cx : cx - jum) + '" y1="' + (vert ? cy - jum : cy) +
               '" x2="' + (vert ? cx : cx + jum) + '" y2="' + (vert ? cy + jum : cy) +
               '" class="sk-maner"/>');
      });
    }

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sk" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false">' + o.join('') + '</svg>';
  }

  /* ---------- setările atelierului, puse peste model ----------

     Omul își ține minte felul de lucru (materialul, rosturile, soclul...) și
     la un corp nou el se pune singur peste valorile modelului. Regula stă
     AICI, o singură dată, fiindcă o folosesc două locuri: editorul, când se
     creează corpul, și cardurile din catalog, care trebuie să arate corpul
     care va ieși — nu modelul curat. Două copii ale regulii ar ajunge să
     spună lucruri diferite, adică exact greșeala de reparat. */
  var GRUPE_SETARI = [
    { id: 'material',   camp: ['t', 'cg', 'cs'] },
    { id: 'spate',      camp: ['spate', 'tp'] },
    { id: 'usi',        camp: ['montaj', 'balama', 'rm', 'ri', 'rinc'] },
    { id: 'polite',     camp: ['jp', 'rp'] },
    { id: 'sertare',    camp: ['hFront', 'hCutie', 'jg', 'ts'] },
    { id: 'dimensiuni', camp: ['W', 'H', 'D', 'constr'] },
    { id: 'cantitati',  camp: ['nUsi', 'nPol', 'nDsp', 'nSer'] },
    { id: 'soclu',      camp: ['soclu'] },
    { id: 'traverse',   camp: ['traverse'] },
    { id: 'faraFront',  camp: ['faraFront'] }
  ];

  function campuriGrup(id) {
    for (var i = 0; i < GRUPE_SETARI.length; i++) {
      if (GRUPE_SETARI[i].id === id) return GRUPE_SETARI[i].camp.slice();
    }
    return [];
  }

  /* Pune setările `s` ({ grupe: {id: bool}, val: {camp: valoare} }) peste
     `params`, pe loc. Întoarce `true` dacă s-a schimbat ceva.
       o.cheiModel — ce a hotărât modelul rămâne al modelului
       o.pePodea   — soclul numai la corpurile care stau pe podea
       o.matFixat  — în comandă, materialul vine din comandă */
  function aplicaSetari(params, s, o) {
    o = o || {};
    if (!s || !s.grupe || !s.val) return false;
    var dinModel = o.cheiModel || [];
    var atins = false;
    var socluInainte = +params.soclu || 0;

    GRUPE_SETARI.forEach(function (g) {
      if (!s.grupe[g.id]) return;
      if (g.id === 'material' && o.matFixat) return;
      if (g.id === 'soclu' && !o.pePodea) return;
      g.camp.forEach(function (f) {
        if (s.val[f] === undefined) return;
        if (dinModel.indexOf(f) !== -1) return;
        params[f] = s.val[f];
        atins = true;
      });
    });

    /* Soclul pus peste un model care n-avea: ÎNĂLȚIMEA CREȘTE CU EL. `H` e
       cota de la podea; modelul a spus cât corp folositor vrea, atâta
       rămâne, iar soclul se adaugă dedesubt. */
    var socluDupa = +params.soclu || 0;
    if (socluDupa > socluInainte && +params.H > 0) {
      params.H = +params.H + (socluDupa - socluInainte);
      atins = true;
    }
    return atins;
  }

  /* Ce cotă a hotărât modelul, ca setările să nu calce peste ea. */
  function cheileModelului(id) {
    var m = id ? byId(String(id)) : null;
    return m && m.set ? Object.keys(m.set) : [];
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
    /* Corpul cu coș Jolly are un front, dar nu e „o ușă": se scrie coșul. */
    if (+p.jolly) b.push(t_('rezumat.jolly'));
    else if (+p.nUsi) b.push(t_('corpuri.metaUsi', { n: +p.nUsi }));
    if (+p.nSer) b.push(t_('corpuri.metaSertare', { n: +p.nSer }));
    if (+p.nPol) b.push(t_('corpuri.metaPolite', { n: +p.nPol }));
    /* Pe ce stă corpul. Numai cand are soclu: „pe picioare" e felul
       obisnuit, si scris pe fiecare card ar fi zgomot. */
    if (+p.soclu > 0) b.push(t_('rezumat.peSoclu', { h: +p.soclu }));
    if (+p.traverse > 0) b.push(t_('rezumat.cuTraverse', { lat: +p.traverse }));
    /* Fără fronturi se scrie ORICUM, chiar dacă rândul e deja plin: e
       singurul lucru de pe card care schimbă ce pleacă din atelier. */
    if (+p.faraFront) b.push(t_('rezumat.faraFront'));
    /* Vitrina se recunoaște după uși: altfel cardul ar arăta ca un dulap. */
    if (+p.usiSticla && !+p.faraFront && +p.nUsi > 0) b.push(t_('rezumat.usiSticla'));
    /* Unde stau sertarele schimbă fața corpului, deci se scrie pe card. */
    if (+p.sertareJos && +p.nSer > 0) b.push(t_('rezumat.sertareJos'));
    /* Fără mâner se scrie; cu mâner nu, că ăla e felul obișnuit. */
    if (!+p.maner && !+p.faraFront && (+p.nUsi > 0 || +p.nSer > 0)) {
      b.push(t_('rezumat.faraManer'));
    }
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
    return !!(m && (m.podea || PE_PODEA.indexOf(m.cat) !== -1));
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
    rezumat: rezumat,
    GRUPE_SETARI: GRUPE_SETARI,
    campuriGrup: campuriGrup,
    aplicaSetari: aplicaSetari,
    cheileModelului: cheileModelului
  };
});
