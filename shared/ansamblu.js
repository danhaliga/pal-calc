/* ============================================================
   Ansamblul: corpurile așezate în cameră, alipite unul de altul.

   Camera e o cutie cu laturile A (pe X) și B (pe Z) și înălțimea H.
   Pereții, priviți de sus, cu colțul de start în stânga-jos:

        C (z = B)
     +------------+
   B |            | D        A = peretele din spate (z = 0), corpurile privesc spre +Z
     |            |          B = peretele din stânga (x = 0), privesc spre +X
     +------------+          C = peretele din față (z = B), privesc spre -Z
        A (z = 0)            D = peretele din dreapta (x = A), privesc spre -X

   Un corp are: peretele, distanța de la colțul de start al peretelui și
   înălțimea de la podea. Alipirea înseamnă distanțe puse cap la cap.
   ============================================================ */
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./calc') : root.PalCalc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalAnsamblu = api;
})(typeof self !== 'undefined' ? self : this, function (PalCalc) {
  'use strict';

  var PERETI = [
    { id: 'A', latura: 'A', rot: 0 },
    { id: 'B', latura: 'B', rot: 90 },
    { id: 'C', latura: 'A', rot: 180 },
    { id: 'D', latura: 'B', rot: 270 }
  ];

  /* Pereții cu numele scrise în limba cerută. */
  function pereti(tr) {
    var t_ = PalCalc.traducator(tr);
    return PERETI.map(function (p) {
      return Object.assign({ nume: t_('perete.' + p.id) }, p);
    });
  }

  var r1 = function (v) { return Math.round(v * 10) / 10; };

  function peretele(id) {
    return PERETI.filter(function (p) { return p.id === id; })[0] || PERETI[0];
  }

  function camera(c) {
    var v = c || {};
    return { A: +v.A || 3200, B: +v.B || 2400, H: +v.H || 2500 };
  }

  /* lungimea peretelui pe care stă corpul */
  function lungimePerete(cam, peretId) {
    return peretele(peretId).latura === 'A' ? cam.A : cam.B;
  }

  /* Gabaritul unui corp în plan.
     „adancime” este cât ocupă în plan perpendicular pe perete — la un corp de colț
     asta e latura de pe peretele vecin, pentru că desenul cuprinde tot colțul.
     „adancimeReala” este cât iese corpul din perete, adică adâncimea brațelor;
     după ea se hotărăște dacă un corp stă jos sau se prinde suspendat. */
  function gabarit(params) {
    var tip = params.tip;
    if (tip === 'colt-L' || tip === 'colt-diagonal') {
      return { latime: +params.W, adancime: +params.W2, adancimeReala: +params.D,
               colt: true, W2: +params.W2 };
    }
    if (tip === 'atipic') {
      var g = PalCalc.conturGeometrie(params.contur || []);
      return { latime: g.W || +params.W, adancime: +params.D, adancimeReala: +params.D,
               inaltime: g.H || +params.H };
    }
    return { latime: +params.W, adancime: +params.D, adancimeReala: +params.D };
  }

  function inaltimeCorp(params) {
    if (params.tip === 'atipic') {
      var g = PalCalc.conturGeometrie(params.contur || []);
      return g.H || +params.H;
    }
    return +params.H;
  }

  function pozitieImplicita(params) {
    return { perete: 'A', d: 0, h: 0 };
  }

  function citestePozitie(corp) {
    var p = corp.pozitie;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    if (!p) return pozitieImplicita(corp.params);
    return {
      perete: peretele(p.perete).id,
      d: +p.d || 0,
      h: +p.h || 0
    };
  }

  /* ---------- așezarea ---------- */

  /* Alipește corpurile de pe un perete: le pune cap la cap, în ordinea din comandă,
     pornind din colț. Corpurile de colț rămân primele, ca să prindă colțul. */
  function alipeste(corpuri, cam, peretId, dStart) {
    var d = dStart || 0;
    var rezultat = [];
    corpuri.forEach(function (c) {
      var g = gabarit(c.params);
      rezultat.push({ id: c.id, perete: peretId, d: r1(d), h: c.pozitie ? c.pozitie.h : 0 });
      d += g.latime;
    });
    return { pozitii: rezultat, lungime: r1(d), lungimePerete: lungimePerete(cam, peretId) };
  }

  /* Geometria în plan a unui corp așezat: dreptunghiul ocupat și poziția în 3D. */
  function asezare(corp, poz, cam) {
    var g = gabarit(corp.params);
    var per = peretele(poz.perete);
    var H = inaltimeCorp(corp.params);
    var W = g.latime, D = g.adancime;

    var x, z, plan;
    if (per.id === 'A') {
      x = poz.d; z = 0;
      plan = { x0: poz.d, z0: 0, x1: poz.d + W, z1: D };
    } else if (per.id === 'B') {
      x = 0; z = poz.d + W;
      plan = { x0: 0, z0: poz.d, x1: D, z1: poz.d + W };
    } else if (per.id === 'C') {
      x = poz.d + W; z = cam.B;
      plan = { x0: poz.d, z0: cam.B - D, x1: poz.d + W, z1: cam.B };
    } else {
      x = cam.A; z = poz.d;
      plan = { x0: cam.A - D, z0: poz.d, x1: cam.A, z1: poz.d + W };
    }

    return {
      id: corp.id, nume: corp.nume || corp.name, poz: poz,
      /* `poz` de mai sus e POZIȚIA în cameră ({perete, d, h}); `nr` e numărul
         corpului în comandă (coloana corps.poz), acela după care se codează
         piesele în lista de debitare — 4.1, 4.2 — și acela scris pe fișa de
         montaj. Fără el, planșa de ansamblu numerota cu indexul din vector și
         trimitea omul la alt corp. Rămâne null dacă apelantul nu-l dă;
         ansamblu() îl completează. */
      nr: corp.poz != null ? corp.poz : null,
      W: W, D: D, H: H,
      /* pentru 3D: originea grupului și rotația în jurul verticalei */
      origine: { x: x, y: poz.h, z: z },
      rotatie: per.rot * Math.PI / 180,
      plan: plan,
      colt: !!g.colt, W2: g.W2,
      perete: per
    };
  }

  /* ---------- verificări ---------- */

  function verifica(asezari, cam, tr) {
    var t_ = PalCalc.traducator(tr);
    var probleme = [];

    /* depășirea peretelui */
    PERETI.forEach(function (per) {
      var lung = lungimePerete(cam, per.id);
      asezari.filter(function (a) { return a.perete.id === per.id; }).forEach(function (a) {
        if (a.poz.d < -0.5) {
          probleme.push({ tip: 'inainte', corp: a.nume,
            text: t_('ansamblu.probInainte', { corp: a.nume, perete: per.id }) });
        }
        if (a.poz.d + a.W > lung + 0.5) {
          probleme.push({ tip: 'depasire', corp: a.nume,
            text: t_('ansamblu.probDepasire', { corp: a.nume, perete: per.id,
                                                mm: r1(a.poz.d + a.W - lung) }) });
        }
        if (a.poz.h + a.H > cam.H + 0.5) {
          probleme.push({ tip: 'inaltime', corp: a.nume,
            text: t_('ansamblu.probInaltime', { corp: a.nume,
                                                mm: r1(a.poz.h + a.H - cam.H) }) });
        }
      });
    });

    /* suprapuneri pe același perete, la aceeași înălțime */
    for (var i = 0; i < asezari.length; i++) {
      for (var j = i + 1; j < asezari.length; j++) {
        var a = asezari[i], b = asezari[j];
        if (a.perete.id !== b.perete.id) continue;
        var peX = Math.min(a.poz.d + a.W, b.poz.d + b.W) - Math.max(a.poz.d, b.poz.d);
        var peY = Math.min(a.poz.h + a.H, b.poz.h + b.H) - Math.max(a.poz.h, b.poz.h);
        if (peX > 0.5 && peY > 0.5) {
          probleme.push({ tip: 'suprapunere', corp: a.nume,
            text: t_('ansamblu.probSuprapunere', { a: a.nume, b: b.nume,
                                                   perete: a.perete.id, mm: r1(peX) }) });
        }
      }
    }

    return probleme;
  }

  /* peretele următor în sensul A → B → C → D */
  function peretUrmator(id) {
    var i = PERETI.findIndex(function (p) { return p.id === id; });
    return PERETI[(i + 1) % PERETI.length].id;
  }

  /* Golurile rămase pe fiecare perete, pe fiecare nivel de înălțime.
     Un corp de colț ține și începutul peretelui următor, cu brațul lui de acolo:
     altfel bucata aceea ar fi raportată greșit ca gol. */
  function goluri(asezari, cam) {
    var out = [];

    PERETI.forEach(function (per) {
      var peP = asezari.filter(function (a) { return a.perete.id === per.id; });

      /* brațul unui colț de pe peretele dinainte */
      var venitDinColt = asezari.filter(function (a) {
        return a.colt && a.poz.d < 1 && peretUrmator(a.perete.id) === per.id;
      }).map(function (a) {
        return { poz: { d: 0, h: a.poz.h }, W: a.W2 || 0, H: a.H, nume: a.nume, _colt: true };
      });

      var toate = peP.concat(venitDinColt);
      if (!toate.length) return;

      var niveluri = {};
      toate.forEach(function (a) { (niveluri[a.poz.h] = niveluri[a.poz.h] || []).push(a); });

      Object.keys(niveluri).forEach(function (h) {
        var lista = niveluri[h].slice().sort(function (x, y) { return x.poz.d - y.poz.d; });
        var lung = lungimePerete(cam, per.id);
        var cursor = 0;
        lista.forEach(function (a) {
          if (a.poz.d - cursor > 1) {
            out.push({ perete: per.id, h: +h, de_la: r1(cursor), pana_la: r1(a.poz.d),
                       lung: r1(a.poz.d - cursor) });
          }
          cursor = Math.max(cursor, a.poz.d + a.W);
        });
        if (lung - cursor > 1) {
          out.push({ perete: per.id, h: +h, de_la: r1(cursor), pana_la: r1(lung),
                     lung: r1(lung - cursor) });
        }
      });
    });
    return out;
  }

  /* ---------- desene ---------- */

  /* vedere de sus: camera și corpurile așezate */
  function planCamera(asezari, cam) {
    var pad = Math.max(cam.A, cam.B) * 0.09;
    var fs = Math.max(cam.A, cam.B) / 42;
    var o = [];

    o.push('<rect x="0" y="0" width="' + cam.A + '" height="' + cam.B + '" class="an-camera"/>');

    asezari.forEach(function (a, i) {
      var p = a.plan;
      o.push('<rect x="' + p.x0 + '" y="' + p.z0 + '" width="' + (p.x1 - p.x0) +
             '" height="' + (p.z1 - p.z0) + '" class="an-corp' + (a.poz.h > 0 ? ' sus' : '') + '"/>');
      var cx = (p.x0 + p.x1) / 2, cy = (p.z0 + p.z1) / 2;
      /* numărul corpului din comandă, nu indexul din vector: după o ștergere
         de corp numerele au goluri, iar legenda promite „pozițiile din comandă" */
      o.push('<text x="' + cx + '" y="' + cy + '" class="an-eticheta" text-anchor="middle" ' +
             'dominant-baseline="central" font-size="' + fs + '">' +
             (a.nr != null ? a.nr : i + 1) + '</text>');
    });

    /* cotele camerei */
    o.push('<text x="' + (cam.A / 2) + '" y="' + (-pad * 0.3) + '" text-anchor="middle" font-size="' +
           fs + '" class="an-cota">' + cam.A + ' mm</text>');
    o.push('<text x="' + (-pad * 0.35) + '" y="' + (cam.B / 2) + '" text-anchor="middle" font-size="' +
           fs + '" class="an-cota" transform="rotate(-90 ' + (-pad * 0.35) + ' ' + (cam.B / 2) + ')">' +
           cam.B + ' mm</text>');

    /* numele pereților */
    o.push('<text x="' + (cam.A / 2) + '" y="' + (pad * 0.5) + '" text-anchor="middle" font-size="' +
           (fs * 0.85) + '" class="an-perete">A</text>');
    o.push('<text x="' + (pad * 0.45) + '" y="' + (cam.B / 2) + '" text-anchor="middle" font-size="' +
           (fs * 0.85) + '" class="an-perete">B</text>');
    o.push('<text x="' + (cam.A / 2) + '" y="' + (cam.B - pad * 0.25) + '" text-anchor="middle" font-size="' +
           (fs * 0.85) + '" class="an-perete">C</text>');
    o.push('<text x="' + (cam.A - pad * 0.45) + '" y="' + (cam.B / 2) + '" text-anchor="middle" font-size="' +
           (fs * 0.85) + '" class="an-perete">D</text>');

    return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (cam.A + 2 * pad) + ' ' + (cam.B + 2 * pad) +
           '" class="an-svg" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false">' + o.join('') + '</svg>';
  }

  /* vedere din față pentru un perete: corpurile la înălțimea lor */
  function elevatie(asezari, cam, peretId) {
    var lung = lungimePerete(cam, peretId);
    var peP = asezari.filter(function (a) { return a.perete.id === peretId; });
    var pad = Math.max(lung, cam.H) * 0.07;
    var fs = Math.max(lung, cam.H) / 40;
    var o = [];

    o.push('<rect x="0" y="0" width="' + lung + '" height="' + cam.H + '" class="an-zid"/>');
    o.push('<line x1="0" y1="' + cam.H + '" x2="' + lung + '" y2="' + cam.H + '" class="an-podea"/>');

    peP.forEach(function (a, i) {
      var y = cam.H - a.poz.h - a.H;      /* SVG are originea sus */
      o.push('<rect x="' + a.poz.d + '" y="' + y + '" width="' + a.W + '" height="' + a.H +
             '" class="an-fata' + (a.poz.h > 0 ? ' sus' : '') + '"/>');
      /* Numărul corpului deasupra, lățimea dedesubt. Înainte era scrisă doar
         lățimea, deci un desen cu trei corpuri de 600 nu spunea care e care,
         iar tabelul de lângă numerota altfel.
         Numărul are una-două cifre, deci încape și într-un corp îngust, unde
         lățimea de trei cifre nu încăpea — și tocmai corpul îngust de umplutură
         e cel pe care vrei să-l poți identifica. */
      var incapeNumar = a.W > fs * 0.9 && a.H > fs * 1.2;
      var incapeLatime = incapeNumar && a.W > lung * 0.06 && a.H > fs * 2.4;
      if (incapeNumar) {
        var cx = a.poz.d + a.W / 2, cy = y + a.H / 2;
        o.push('<text x="' + cx + '" y="' + (incapeLatime ? cy - fs * 0.45 : cy) +
               '" class="an-eticheta" text-anchor="middle" dominant-baseline="central" ' +
               'font-size="' + fs + '">' + (a.nr != null ? a.nr : i + 1) + '</text>');
        if (incapeLatime) {
          o.push('<text x="' + cx + '" y="' + (cy + fs * 0.6) + '" class="an-cota" ' +
                 'text-anchor="middle" dominant-baseline="central" font-size="' + (fs * 0.7) + '">' +
                 a.W + '</text>');
        }
      }
    });

    o.push('<text x="' + (lung / 2) + '" y="' + (cam.H + pad * 0.6) + '" text-anchor="middle" font-size="' +
           fs + '" class="an-cota">' + lung + ' mm</text>');

    return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (lung + 2 * pad) + ' ' + (cam.H + 2 * pad) +
           '" class="an-svg" preserveAspectRatio="xMidYMid meet" ' +
           'aria-hidden="true" focusable="false">' + o.join('') + '</svg>';
  }

  /* ---------- totul la un loc ---------- */

  function ansamblu(comanda, corpuri, tr) {
    var t_ = PalCalc.traducator(tr);
    var cam = camera(comanda.camera);
    var asezari = corpuri.map(function (c, i) {
      var a = asezare(c, citestePozitie(c), cam);
      /* dacă apelantul n-a dat numărul din comandă, cădem pe ordinal — dar
         atunci ordinea de intrare trebuie să fie chiar cea din comandă */
      if (a.nr == null) a.nr = i + 1;
      return a;
    });

    var peReti = pereti(t_).map(function (per) {
      var lista = asezari.filter(function (a) { return a.perete.id === per.id; });
      var jos = lista.filter(function (a) { return a.poz.h === 0; });
      var sus = lista.filter(function (a) { return a.poz.h > 0; });
      return {
        id: per.id, nume: per.nume,
        lungime: lungimePerete(cam, per.id),
        corpuri: lista,
        ocupatJos: r1(jos.reduce(function (s, a) { return s + a.W; }, 0)),
        ocupatSus: r1(sus.reduce(function (s, a) { return s + a.W; }, 0))
      };
    });

    return {
      camera: cam,
      pereti: peReti,
      asezari: asezari,
      probleme: verifica(asezari, cam, t_),
      goluri: goluri(asezari, cam),
      plan: planCamera(asezari, cam)
    };
  }

  return {
    PERETI: PERETI,
    pereti: pereti,
    camera: camera,
    peretele: peretele,
    lungimePerete: lungimePerete,
    gabarit: gabarit,
    inaltimeCorp: inaltimeCorp,
    citestePozitie: citestePozitie,
    alipeste: alipeste,
    asezare: asezare,
    verifica: verifica,
    goluri: goluri,
    peretUrmator: peretUrmator,
    planCamera: planCamera,
    elevatie: elevatie,
    ansamblu: ansamblu
  };
});
