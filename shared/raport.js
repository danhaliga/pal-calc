/* ============================================================
   Raportul unei comenzi: piese, plăci necesare, cant, feronerie, CNC.

   Ia corpurile comenzii, le trece prin calc() și agregă tot ce trebuie
   ca să dai comanda la fabrică și să montezi mobila.
   ============================================================ */
(function (root, factory) {
  var api = factory(
    typeof module === 'object' && module.exports ? require('./calc') : root.PalCalc,
    typeof module === 'object' && module.exports ? require('./nesting') : root.Croire
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalRaport = api;
})(typeof self !== 'undefined' ? self : this, function (PalCalc, Nesting) {
  'use strict';

  /* formatul standard de placă la noi în piață */
  var PLACA = { w: 2800, h: 2070 };
  var KERF = 4;                 /* grosimea discului la debitare */
  var ADAOS_CANT_MIN = 10;      /* procentul minim adăugat la cant */

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  /* ---------- materialul din care se face o piesă ---------- */

  function materialPiesa(p, c) {
    var t = +c.t, tp = +c.tp, ts = +c.ts;
    if (/fund PFL/i.test(p.nume)) return { key: 'pfl3', tip: 'PFL', gros: 3 };
    if (/^Spate/i.test(p.nume)) {
      return tp >= 8
        ? { key: 'pal' + tp, tip: 'PAL', gros: tp }
        : { key: 'pfl' + tp, tip: 'PFL', gros: tp };
    }
    if (/^Sertar/i.test(p.nume)) return { key: 'pal' + ts, tip: 'PAL', gros: ts };
    return { key: 'pal' + t, tip: 'PAL', gros: t };
  }

  /* ---------- geometria panourilor de colț ---------- */

  function polyBounds(poly) {
    var xs = poly.map(function (p) { return p[0]; });
    var ys = poly.map(function (p) { return p[1]; });
    return {
      x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
      y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys)
    };
  }

  /* Muchiile care nu stau pe conturul dreptunghiului de gabarit sunt muchiile
     frontale: ele se cantuiesc și tot ele cer prelucrare după debitare. */
  function muchiiFrontale(poly) {
    var b = polyBounds(poly), eps = 0.01, out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], c = poly[(i + 1) % poly.length];
      var peContur =
        (Math.abs(a[0] - b.x0) < eps && Math.abs(c[0] - b.x0) < eps) ||
        (Math.abs(a[0] - b.x1) < eps && Math.abs(c[0] - b.x1) < eps) ||
        (Math.abs(a[1] - b.y0) < eps && Math.abs(c[1] - b.y0) < eps) ||
        (Math.abs(a[1] - b.y1) < eps && Math.abs(c[1] - b.y1) < eps);
      if (peContur) continue;
      out.push({ de_la: a, la: c, lung: r1(Math.hypot(c[0] - a[0], c[1] - a[1])) });
    }
    return out;
  }

  function polyPiesa(p) {
    for (var i = 0; i < p.boxes.length; i++) if (p.boxes[i].poly) return p.boxes[i].poly;
    return null;
  }

  /* ---------- cantul unei piese ---------- */

  function cantPiesa(p, c) {
    var cg = +c.cg, cs = +c.cs;
    var val = function (v) { return v === 'g' ? cg : v === 's' ? cs : 0; };
    var poly = polyPiesa(p);

    /* panou de colț: cantul merge pe muchiile frontale, nu pe laturile gabaritului */
    if (poly) {
      var ml = muchiiFrontale(poly).reduce(function (s, m) { return s + m.lung; }, 0) / 1000 * p.buc;
      return {
        muchii: ['–', '–', '–', '–'],
        special: true,
        pe_grosime: ml > 0 ? [{ mm: cg, ml: ml }] : [],
        ml: r2(ml)
      };
    }

    var pe = {};
    var adauga = function (mm, lung) {
      if (!mm || !lung) return;
      pe[mm] = (pe[mm] || 0) + lung * p.buc / 1000;
    };
    adauga(val(p.c[0]), p.L);
    adauga(val(p.c[1]), p.L);
    adauga(val(p.c[2]), p.l);
    adauga(val(p.c[3]), p.l);

    /* ml rămâne nerotunjit: se rotunjește abia la totalul comenzii */
    var lista = Object.keys(pe).map(function (mm) {
      return { mm: +mm, ml: pe[mm] };
    }).sort(function (a, b) { return a.mm - b.mm; });

    return {
      muchii: p.c.map(function (v) { return v === '-' ? '–' : String(val(v)); }),
      special: false,
      pe_grosime: lista,
      ml: r2(lista.reduce(function (s, x) { return s + x.ml; }, 0))
    };
  }

  /* ---------- prelucrări CNC ---------- */

  function cncPiesa(p, c, corp) {
    var out = [];
    var poly = polyPiesa(p);

    if (poly) {
      var b = polyBounds(poly);
      var muchii = muchiiFrontale(poly);
      var diagonal = muchii.length === 1;
      var detalii;

      if (diagonal) {
        detalii = 'tăiere la 45°, muchie diagonală ' + r1(muchii[0].lung) + ' mm, cantuită';
      } else {
        /* colțul interior este punctul comun al celor două muchii frontale */
        var cx = muchii[0].la[0], cy = muchii[0].la[1];
        detalii = 'decupaj ' + r1(b.x1 - cx) + ' × ' + r1(b.y1 - cy) + ' mm din colț; muchii cantuite ' +
                  muchii.map(function (m) { return r1(m.lung); }).join(' + ') + ' mm';
      }

      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: diagonal ? 'Tăiere la 45°' : 'Decupaj colț interior',
        gabarit: { L: p.TL, l: p.Tl },
        poly: poly, bounds: b, muchii: muchii, detalii: detalii
      });
    }

    /* nutul pentru spate se frezează, nu se taie pe panglică */
    if ((c.spate === 'nut' || c.spate === 'pal') && /^(Laterală|Blat|Fund)$/.test(p.nume)) {
      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: 'Nut pentru spate',
        gabarit: { L: p.TL, l: p.Tl },
        poly: null, bounds: null, muchii: [],
        detalii: 'nut de ' + (+c.tp) + ' mm lățime, adâncime ' + PalCalc.NUT_AD +
                 ' mm, la ' + PalCalc.NUT_OFF + ' mm de muchia din spate'
      });
    }
    return out;
  }

  /* ---------- feronerie ---------- */

  function feronerie(params, res) {
    var c = params;
    var nUsi = +c.nUsi, nSer = +c.nSer, nPol = +c.nPol;
    var items = [];
    var pune = function (nume, qty, um, obs) {
      if (qty <= 0) return;
      var gasit = items.filter(function (x) { return x.nume === nume; })[0];
      if (gasit) { gasit.qty += qty; return; }
      items.push({ nume: nume, qty: qty, um: um || 'buc', obs: obs || '' });
    };

    /* balamale: numărate pe fiecare ușă din listă, după înălțimea ei */
    var usiPiese = res.P.filter(function (p) { return /^Ușă/.test(p.nume); });
    var totalBalamale = 0, perUsa = 0;
    usiPiese.forEach(function (p) {
      var n = PalCalc.balamale(p.L);
      totalBalamale += n * p.buc;
      perUsa = Math.max(perUsa, n);
    });
    if (totalBalamale) {
      pune('Balama cupă Ø35, cot ' + c.balama, totalBalamale, 'buc', 'câte ' + perUsa + ' pe ușă');
      pune('Euroșurub 6.3×13 (balamale)', totalBalamale * 4);
    }
    if (c.tip === 'colt-L' && nUsi >= 2) {
      pune('Balama-carte pentru colț', 1, 'buc', 'cuplează cele două fronturi');
    }

    /* sertare */
    if (nSer > 0) {
      var lg = +c.lg;
      if (!lg) lg = Math.floor((res.Dint - 10) / 50) * 50;
      pune('Set glisiere cu bilă ' + lg + ' mm', nSer, 'set', 'câte 2 bucăți pe set');
      pune('Șurub 3.5×16 (glisiere)', nSer * 8);
    }

    /* polițe */
    if (nPol > 0) pune('Suport poliță', nPol * 4);

    /* carcasă: 4 îmbinări între orizontale și laterale */
    var imbinari = 4;
    if (c.tip === 'colt-L' || c.tip === 'colt-diagonal') imbinari = 4;
    pune('Confirmat 6.3×50', imbinari * 3, 'buc', 'câte 3 pe îmbinare');
    pune('Diblu lemn 8×30', imbinari * 2);

    /* spate */
    if (c.spate === 'aplicat') {
      var perim = 2 * ((+c.W) + (+c.H)) / 1000;
      pune('Holșurub 3.5×16 (spate)', Math.ceil(perim * 1000 / 150), 'buc', 'la fiecare 150 mm');
    }

    /* fronturi */
    pune('Mâner', nUsi + nSer);
    pune('Șurub mâner M4', (nUsi + nSer) * 2);
    pune('Amortizor / tampon', (nUsi + nSer) * 2);

    return items;
  }

  /* ---------- necesarul de plăci ---------- */

  function necesarPlaci(piese, optiuni) {
    var grupe = {};
    piese.forEach(function (p) {
      var k = p.material.key;
      (grupe[k] = grupe[k] || { info: p.material, piese: [] }).piese.push(p);
    });

    return Object.keys(grupe).map(function (k) {
      var g = grupe[k];
      var pieseNest = [];
      g.piese.forEach(function (p) {
        for (var i = 0; i < p.buc; i++) {
          pieseNest.push({
            id: p.id + '#' + i, materialId: k, label: p.nume,
            cw: p.TL, ch: p.Tl,
            rotatable: /^–/.test(p.fibra) || p.fibra === '–'
          });
        }
      });

      var rez = Nesting.optimize({
        materials: [{ id: k, name: g.info.tip + ' ' + g.info.gros, color: '#e9dcc0',
                      sheets: [{ w: PLACA.w, h: PLACA.h, qty: 0 }] }],
        pieces: pieseNest,
        settings: { kerf: KERF, trim: 0, minOffcut: 250,
                    effortMs: (optiuni && optiuni.effortMs != null) ? optiuni.effortMs : 250 }
      });

      var m2piese = pieseNest.reduce(function (s, p) { return s + p.cw * p.ch; }, 0) / 1e6;
      var placi = rez.totals.sheets;

      return {
        key: k,
        tip: g.info.tip,
        gros: g.info.gros,
        nume: g.info.tip + ' ' + g.info.gros + ' mm',
        bucati: pieseNest.length,
        m2piese: r2(m2piese),
        placi: placi,
        m2placi: r2(placi * PLACA.w * PLACA.h / 1e6),
        deseuPct: r1(rez.totals.wastePct),
        format: PLACA.w + ' × ' + PLACA.h,
        neplasate: rez.totals.unplaced,
        plan: rez.perMaterial[0] ? rez.perMaterial[0].bins : []
      };
    }).sort(function (a, b) { return b.gros - a.gros; });
  }

  /* ---------- raportul complet ---------- */

  function raport(comanda, corpuri, optiuni) {
    optiuni = optiuni || {};
    var adaos = Math.max(ADAOS_CANT_MIN, +(comanda.adaos_cant || 15));

    var toateP = [], cnc = [], feroTotal = [], corpuriOut = [];
    var cantPe = {};

    var pune = function (lista, nume, qty, um, obs) {
      var g = lista.filter(function (x) { return x.nume === nume; })[0];
      if (g) { g.qty += qty; return; }
      lista.push({ nume: nume, qty: qty, um: um || 'buc', obs: obs || '' });
    };

    corpuri.forEach(function (corp, idx) {
      var params = corp.params;
      var res = PalCalc.calc(params);
      var pozCorp = corp.poz || (idx + 1);
      var piese = res.P.map(function (p, i) {
        var mat = materialPiesa(p, params);
        var cant = cantPiesa(p, params);
        var rand = {
          id: 'c' + corp.id + 'p' + i,
          corpId: corp.id, corpNume: corp.name, corpPoz: pozCorp,
          cod: pozCorp + '.' + (i + 1),
          nume: p.nume, buc: p.buc,
          L: p.L, l: p.l, TL: p.TL, Tl: p.Tl,
          fibra: p.fibra, nota: p.nota || '',
          material: mat, cant: cant,
          cnc: !!polyPiesa(p)
        };
        cant.pe_grosime.forEach(function (x) {
          cantPe[x.mm] = (cantPe[x.mm] || 0) + x.ml;
        });
        return rand;
      });

      var fero = feronerie(params, res);
      fero.forEach(function (f) { pune(feroTotal, f.nume, f.qty, f.um, f.obs); });

      res.P.forEach(function (p) {
        cncPiesa(p, params, { id: corp.id, nume: corp.name }).forEach(function (x) { cnc.push(x); });
      });

      toateP = toateP.concat(piese);
      corpuriOut.push({
        id: corp.id, nume: corp.name, poz: pozCorp, params: params, res: res,
        piese: piese, feronerie: fero, avertismente: res.warn,
        dimensiuni: (params.tip === 'colt-L' || params.tip === 'colt-diagonal')
          ? params.W + ' × ' + params.H + ' × ' + params.W2 + ' (colț)'
          : params.W + ' × ' + params.H + ' × ' + params.D,
        bucati: piese.reduce(function (s, p) { return s + p.buc; }, 0)
      });
    });

    var materiale = necesarPlaci(toateP, optiuni);

    var cant = Object.keys(cantPe).map(function (mm) {
      var ml = r2(cantPe[mm]);
      return { mm: +mm, ml: ml, cuAdaos: r2(ml * (1 + adaos / 100)), role: Math.ceil(ml * (1 + adaos / 100) / 50) };
    }).sort(function (a, b) { return a.mm - b.mm; });

    return {
      comanda: comanda,
      corpuri: corpuriOut,
      piese: toateP,
      materiale: materiale,
      cant: { adaosPct: adaos, linii: cant, total: r2(cant.reduce(function (s, x) { return s + x.ml; }, 0)),
              totalCuAdaos: r2(cant.reduce(function (s, x) { return s + x.cuAdaos; }, 0)) },
      feronerie: feroTotal.sort(function (a, b) { return a.nume.localeCompare(b.nume, 'ro'); }),
      cnc: cnc,
      totaluri: {
        corpuri: corpuriOut.length,
        randuri: toateP.length,
        bucati: toateP.reduce(function (s, p) { return s + p.buc; }, 0),
        placi: materiale.reduce(function (s, m) { return s + m.placi; }, 0),
        avertismente: corpuriOut.reduce(function (s, c) { return s + c.avertismente.length; }, 0)
      }
    };
  }

  /* ---------- planșa CNC: desenul piesei cu decupajul cotat ---------- */

  function planseCnc(item) {
    if (!item.poly) return '';
    var b = item.bounds;
    var W = b.x1 - b.x0, H = b.y1 - b.y0;
    var pad = Math.max(W, H) * 0.18;
    var fs = Math.max(W, H) / 26;
    var o = [];

    /* gabaritul din care se debitează */
    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="cnc-gabarit"/>');

    /* piesa finită */
    o.push('<polygon points="' + item.poly.map(function (p) {
      return (p[0] - b.x0) + ',' + (H - (p[1] - b.y0));
    }).join(' ') + '" class="cnc-piesa"/>');

    /* muchiile frontale, care se cantuiesc */
    item.muchii.forEach(function (m) {
      o.push('<line x1="' + (m.de_la[0] - b.x0) + '" y1="' + (H - (m.de_la[1] - b.y0)) +
             '" x2="' + (m.la[0] - b.x0) + '" y2="' + (H - (m.la[1] - b.y0)) + '" class="cnc-cant"/>');
      var mx = (m.de_la[0] + m.la[0]) / 2 - b.x0, my = H - ((m.de_la[1] + m.la[1]) / 2 - b.y0);
      o.push('<text x="' + mx + '" y="' + (my - fs * 0.5) + '" class="cnc-cota" ' +
             'text-anchor="middle" font-size="' + fs + '">' + r1(m.lung) + '</text>');
    });

    /* cotele de gabarit */
    o.push('<text x="' + (W / 2) + '" y="' + (-pad * 0.35) + '" text-anchor="middle" ' +
           'font-size="' + fs + '" class="cnc-cota">' + r1(W) + ' mm</text>');
    o.push('<text x="' + (-pad * 0.4) + '" y="' + (H / 2) + '" text-anchor="middle" ' +
           'font-size="' + fs + '" class="cnc-cota" transform="rotate(-90 ' + (-pad * 0.4) + ' ' + (H / 2) + ')">' +
           r1(H) + ' mm</text>');

    return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) +
           '" class="cnc-svg" preserveAspectRatio="xMidYMid meet" role="img" ' +
           'aria-label="Planșă ' + item.piesa + '">' + o.join('') + '</svg>';
  }

  return {
    raport: raport,
    feronerie: feronerie,
    materialPiesa: materialPiesa,
    cantPiesa: cantPiesa,
    muchiiFrontale: muchiiFrontale,
    necesarPlaci: necesarPlaci,
    planseCnc: planseCnc,
    PLACA: PLACA
  };
});
