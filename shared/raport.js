/* ============================================================
   Raportul unei comenzi: piese, plăci necesare, încadrare, cant, feronerie, CNC.

   O comandă poate avea mai multe materiale (decoruri). Fiecare piesă își ia
   materialul după rolul ei: carcasă, fronturi, cutii de sertar, spate.
   Cotele de tăiere se calculează cu cantul materialului piesei, de aceea
   calc() se rulează o dată pentru fiecare material folosit în corp.
   ============================================================ */
(function (root, factory) {
  var api = factory(
    typeof module === 'object' && module.exports ? require('./calc') : root.PalCalc,
    typeof module === 'object' && module.exports ? require('./nesting') : root.Croire,
    typeof module === 'object' && module.exports ? require('./feronerie') : root.PalFeronerie
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalRaport = api;
})(typeof self !== 'undefined' ? self : this, function (PalCalc, Nesting, PalFeronerie) {
  'use strict';

  var COALA = { w: 2800, h: 2070 };
  var KERF = 4;
  var ADAOS_CANT_MIN = 10;

  /* formatele în care se poate tăia o coală */
  var FORMATE = {
    'intreaga': { id: 'intreaga', nume: 'coală întreagă', w: 2800, h: 2070, frac: 1 },
    'jum-lat':  { id: 'jum-lat',  nume: 'jumătate 1400×2070', w: 1400, h: 2070, frac: 0.5 },
    'jum-lung': { id: 'jum-lung', nume: 'jumătate 2800×1035', w: 2800, h: 1035, frac: 0.5 },
    'sfert':    { id: 'sfert',    nume: 'sfert 1400×1035', w: 1400, h: 1035, frac: 0.25 }
  };

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  /* ---------- rolul și materialul unei piese ---------- */

  function rolPiesa(nume) {
    if (/fund PFL/i.test(nume)) return 'pfl';
    if (/^Ușă|^Front sertar/i.test(nume)) return 'front';
    if (/^Spate/i.test(nume)) return 'spate';
    if (/^Sertar/i.test(nume)) return 'sertar';
    return 'corp';
  }

  function palMaterial(m, gros) {
    var decor = m && (m.decor_cod || m.decor_nume) ? (m.decor_cod || m.decor_nume) : 'fără decor';
    var eticheta = 'PAL ' + gros + ' mm';
    if (m && (m.decor_nume || m.decor_cod)) {
      eticheta += ' · ' + [m.decor_cod, m.decor_nume].filter(Boolean).join(' ');
    }
    return {
      key: (m && m.brand ? m.brand : 'PAL') + '|' + decor + '|' + gros,
      tip: 'PAL', gros: gros, nume: eticheta,
      brand: m ? m.brand : null, decor: m ? m.decor_cod : null,
      decorNume: m ? m.decor_nume : null, hex: m ? m.hex : null,
      matId: m ? m.id : null
    };
  }

  function pflMaterial(gros) {
    return {
      key: 'PFL|' + gros, tip: 'PFL', gros: gros, nume: 'PFL ' + gros + ' mm',
      brand: null, decor: null, decorNume: null, hex: null, matId: null
    };
  }

  function materialPiesa(p, c, mats) {
    var rol = rolPiesa(p.nume);
    if (rol === 'pfl') return pflMaterial(3);
    if (rol === 'spate') {
      var tp = +c.tp;
      return tp >= 8 ? palMaterial(mats.corp, tp) : pflMaterial(tp);
    }
    if (rol === 'sertar') return palMaterial(mats.sertar || mats.corp, +c.ts);
    if (rol === 'front') return palMaterial(mats.front || mats.corp, +c.t);
    return palMaterial(mats.corp, +c.t);
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

  /* Muchiile care nu stau pe conturul gabaritului sunt muchiile frontale:
     ele se cantuiesc și tot ele cer prelucrare după debitare. */
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

  /* conturul unei piese decupate: fie panou orizontal (colț), fie panou frontal (corp atipic) */
  function polyPiesa(p) {
    for (var i = 0; i < p.boxes.length; i++) {
      if (p.boxes[i].poly) return p.boxes[i].poly;
      if (p.boxes[i].polyFata) return p.boxes[i].polyFata;
    }
    return null;
  }

  /* piesele tăiate la unghi (laturile unui corp atipic) cer și ele CNC */
  function areUnghiuri(p) {
    return /^Panou \d+ \(/.test(p.nume) && /tăiere .*°/.test(p.nota || '');
  }

  /* un contur care e chiar dreptunghiul de gabarit nu are ce decupa */
  function esteDreptunghi(poly) {
    if (!poly || poly.length !== 4) return false;
    var b = polyBounds(poly);
    return poly.every(function (p) {
      return (Math.abs(p[0] - b.x0) < 0.5 || Math.abs(p[0] - b.x1) < 0.5) &&
             (Math.abs(p[1] - b.y0) < 0.5 || Math.abs(p[1] - b.y1) < 0.5);
    });
  }

  /* ---------- cantul unei piese ---------- */

  function cantPiesa(p, cg, cs) {
    var val = function (v) { return v === 'g' ? cg : v === 's' ? cs : 0; };
    var poly = polyPiesa(p);

    if (poly) {
      var ml = muchiiFrontale(poly).reduce(function (s, m) { return s + m.lung; }, 0) / 1000 * p.buc;
      return {
        muchii: ['–', '–', '–', '–'], special: true,
        pe_grosime: ml > 0 ? [{ mm: cg, ml: ml }] : [], ml: r2(ml)
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

    var lista = Object.keys(pe).map(function (mm) { return { mm: +mm, ml: pe[mm] }; })
                      .sort(function (a, b) { return a.mm - b.mm; });

    return {
      muchii: p.c.map(function (v) { return v === '-' ? '–' : String(val(v)); }),
      special: false, pe_grosime: lista,
      ml: r2(lista.reduce(function (s, x) { return s + x.ml; }, 0))
    };
  }

  /* ---------- prelucrări CNC ---------- */

  function cncPiesa(p, c, corp) {
    var out = [];
    var poly = polyPiesa(p);

    /* laturile unui corp atipic: se taie la unghi la ambele capete */
    if (areUnghiuri(p)) {
      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: 'Tăiere la unghi', gabarit: { L: p.TL, l: p.Tl },
        poly: null, bounds: null, muchii: [], detalii: p.nota
      });
    }

    if (poly) {
      var b = polyBounds(poly);
      var muchii = muchiiFrontale(poly);
      var diagonal = muchii.length === 1;
      var detalii;

      if (c.tip === 'atipic' && !esteDreptunghi(poly)) {
        var bb = polyBounds(poly);
        out.push({
          corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
          tip: 'Decupare după contur',
          gabarit: { L: p.TL, l: p.Tl },
          poly: poly, bounds: bb, muchii: muchiiFrontale(poly),
          detalii: 'se taie dreptunghiul ' + r1(bb.x1 - bb.x0) + ' × ' + r1(bb.y1 - bb.y0) +
                   ' mm și se decupează conturul din desen'
        });
        return out;
      }

      /* un contur care e chiar dreptunghiul de gabarit nu are ce prelucra */
      if (muchii.length) {
        if (diagonal) {
          detalii = 'tăiere la 45°, muchie diagonală ' + r1(muchii[0].lung) + ' mm, cantuită';
        } else {
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
    }

    if ((c.spate === 'nut' || c.spate === 'pal') && /^(Laterală|Blat|Fund)$/.test(p.nume)) {
      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: 'Nut pentru spate', gabarit: { L: p.TL, l: p.Tl },
        poly: null, bounds: null, muchii: [],
        detalii: 'nut de ' + (+c.tp) + ' mm lățime, adâncime ' + PalCalc.NUT_AD +
                 ' mm, la ' + PalCalc.NUT_OFF + ' mm de muchia din spate'
      });
    }
    return out;
  }

  /* ---------- feronerie ---------- */

  /* Feroneria unui corp, după sistemul ales pe comandă. */
  function feronerie(params, res, sistem) {
    var c = params;
    var nUsi = +c.nUsi, nSer = +c.nSer, nPol = +c.nPol;
    var s = sistem || PalFeronerie.sistem(null);
    var items = [];
    var pune = function (nume, qty, um, obs) {
      if (qty <= 0) return;
      var gasit = items.filter(function (x) { return x.nume === nume; })[0];
      if (gasit) { gasit.qty += qty; return; }
      items.push({ nume: nume, qty: qty, um: um || 'buc', obs: obs || '' });
    };
    var rotunjeste = function () {
      items.forEach(function (x) { x.qty = Math.ceil(x.qty); });
      return items;
    };

    /* ---- balamale ---- */
    var usiPiese = res.P.filter(function (p) { return /^Ușă/.test(p.nume); });
    var totalBalamale = 0, perUsa = 0;
    usiPiese.forEach(function (p) {
      var n = PalCalc.balamale(p.L);
      totalBalamale += n * p.buc;
      perUsa = Math.max(perUsa, n);
    });
    if (totalBalamale && s.balama && s.balama.id !== 'fara') {
      pune(s.balama.nume + ', cot ' + c.balama, totalBalamale, 'buc', 'câte ' + perUsa + ' pe ușă');
      (s.balama.consumabile || []).forEach(function (x) {
        pune(x.nume, totalBalamale * x.peBalama);
      });
    }
    if (c.tip === 'colt-L' && nUsi >= 2) {
      pune('Balama-carte pentru colț', 1, 'buc', 'cuplează cele două fronturi');
    }

    /* ---- sertare ---- */
    if (nSer > 0 && s.glisiere && s.glisiere.id !== 'fara') {
      var lg = +c.lg;
      if (!lg) lg = Math.floor((res.Dint - 10) / 50) * 50;
      pune(s.glisiere.nume + ' ' + lg + ' mm', nSer, 'set', 'câte 2 bucăți pe set');
      pune('Șurub 3.5×16 (glisiere)', nSer * (s.glisiere.suruburiPeSet || 8));
    }

    if (nPol > 0) pune('Suport poliță', nPol * 4);

    /* ---- asamblarea carcasei: patru îmbinări între orizontale și laterale ---- */
    var imbinari = 4;
    (s.asamblare.pePiesa || []).forEach(function (x) {
      pune(x.nume, imbinari * x.buc, 'buc',
           x.buc > 1 ? 'câte ' + x.buc + ' pe îmbinare' : 'câte una pe îmbinare');
    });

    /* ---- spate ---- */
    if (c.spate === 'aplicat') {
      var perim = 2 * ((+c.W) + (+c.H)) / 1000;
      pune('Holșurub 3.5×16 (spate)', Math.ceil(perim * 1000 / 150), 'buc', 'la fiecare 150 mm');
    }

    /* ---- suspensii, doar la corpurile subțiri, care se prind pe perete ---- */
    if (s.suspensii && +c.D <= 450 && c.tip !== 'atipic') {
      pune(s.suspensii.nume, s.suspensii.peCorp, 'buc', 'câte două pe corp');
      (s.suspensii.consumabile || []).forEach(function (x) {
        if (x.peSuspensie) pune(x.nume, s.suspensii.peCorp * x.peSuspensie);
      });
    }

    /* ---- fronturi ---- */
    pune('Mâner', nUsi + nSer);
    pune('Șurub mâner M4', (nUsi + nSer) * 2);

    return rotunjeste();
  }

  /* ---------- croirea în coli ---------- */

  function formateAlese(lista) {
    var ids = (lista && lista.length) ? lista : ['intreaga'];
    return ids.map(function (id) { return FORMATE[id]; }).filter(Boolean);
  }

  function necesarPlaci(piese, formate, optiuni) {
    var grupe = {};
    piese.forEach(function (p) {
      var k = p.material.key;
      (grupe[k] = grupe[k] || { info: p.material, piese: [] }).piese.push(p);
    });

    var tipuriColi = formateAlese(formate);

    return Object.keys(grupe).map(function (k) {
      var g = grupe[k];
      var pieseNest = [];
      g.piese.forEach(function (p) {
        for (var i = 0; i < p.buc; i++) {
          pieseNest.push({
            id: p.id + '#' + i, materialId: k, label: p.cod,
            nume: p.nume, corp: p.corpNume,
            cw: p.TL, ch: p.Tl,
            rotatable: p.fibra === '–' || /^–/.test(p.fibra)
          });
        }
      });

      var rez = Nesting.optimize({
        materials: [{
          id: k, name: g.info.nume, color: g.info.hex || '#e9dcc0',
          sheets: tipuriColi.map(function (f) { return { w: f.w, h: f.h, qty: 0, format: f.id }; })
        }],
        pieces: pieseNest,
        settings: { kerf: KERF, trim: 0, minOffcut: 250,
                    effortMs: (optiuni && optiuni.effortMs != null) ? optiuni.effortMs : 250 }
      });

      var bins = rez.perMaterial[0] ? rez.perMaterial[0].bins : [];
      var folosite = {}, echivalent = 0;

      bins.forEach(function (b) {
        var f = tipuriColi.filter(function (x) { return x.w === b.sheet.w && x.h === b.sheet.h; })[0] ||
                FORMATE.intreaga;
        b.format = f;
        folosite[f.id] = (folosite[f.id] || 0) + 1;
        echivalent += f.frac;
      });

      var m2piese = pieseNest.reduce(function (s, p) { return s + p.cw * p.ch; }, 0) / 1e6;
      var ariaColi = bins.reduce(function (s, b) { return s + b.sheet.w * b.sheet.h; }, 0);

      return {
        key: k,
        info: g.info,
        tip: g.info.tip,
        gros: g.info.gros,
        nume: g.info.nume,
        hex: g.info.hex,
        bucati: pieseNest.length,
        m2piese: r2(m2piese),
        bins: bins,
        bucatiColi: Object.keys(folosite).map(function (id) {
          return { format: FORMATE[id], n: folosite[id] };
        }).sort(function (a, b) { return b.format.frac - a.format.frac; }),
        echivalent: r2(echivalent),
        coliIntregi: Math.ceil(echivalent - 0.001),
        m2coli: r2(ariaColi / 1e6),
        deseuPct: ariaColi > 0 ? r1(100 * (1 - m2piese * 1e6 / ariaColi)) : 0,
        neplasate: rez.totals.unplaced
      };
    }).sort(function (a, b) { return b.gros - a.gros; });
  }

  /* ---------- raportul complet ---------- */

  function raport(comanda, corpuri, optiuni) {
    optiuni = optiuni || {};
    var adaos = Math.max(ADAOS_CANT_MIN, +(optiuni.adaosCant != null ? optiuni.adaosCant : 15));
    var formate = comanda.formate || ['intreaga'];

    var sist = PalFeronerie.sistem(comanda.feronerie);

    var toateP = [], cnc = [], feroTotal = [], corpuriOut = [], avertismenteComanda = [];
    var cantPe = {};

    var pune = function (lista, nume, qty, um, obs) {
      var g = lista.filter(function (x) { return x.nume === nume; })[0];
      if (g) { g.qty += qty; return; }
      lista.push({ nume: nume, qty: qty, um: um || 'buc', obs: obs || '' });
    };

    corpuri.forEach(function (corp, idx) {
      var params = corp.params;
      var mats = corp.materiale || {};
      var matCorp = mats.corp || null;
      var matFront = mats.front || matCorp;

      /* cotele de tăiere depind de cantul materialului, deci calculăm o dată
         pentru carcasă și o dată pentru fronturi, când canturile diferă */
      var paramsCorp = Object.assign({}, params, {
        cg: matCorp ? +matCorp.cant_gros : +params.cg,
        cs: matCorp ? +matCorp.cant_subtire : +params.cs
      });
      var paramsFront = Object.assign({}, params, {
        cg: matFront ? +matFront.cant_gros : paramsCorp.cg,
        cs: matFront ? +matFront.cant_subtire : paramsCorp.cs
      });

      var resCorp = PalCalc.calc(paramsCorp);
      var acelasiCant = paramsCorp.cg === paramsFront.cg && paramsCorp.cs === paramsFront.cs;
      var resFront = acelasiCant ? resCorp : PalCalc.calc(paramsFront);

      if (matFront && matCorp && +matFront.pal_mm !== +matCorp.pal_mm) {
        avertismenteComanda.push('„' + corp.name + '”: fronturile sunt din PAL de ' +
          matFront.pal_mm + ' mm, dar geometria e calculată cu grosimea carcasei (' +
          matCorp.pal_mm + ' mm).');
      }

      var pozCorp = corp.poz || (idx + 1);
      var piese = resCorp.P.map(function (p, i) {
        var rol = rolPiesa(p.nume);
        var sursa = (rol === 'front' && !acelasiCant) ? resFront.P[i] : p;
        var mat = materialPiesa(p, params, {
          corp: matCorp, front: matFront, sertar: mats.sertar || matCorp
        });
        var cgP = rol === 'front' ? paramsFront.cg : paramsCorp.cg;
        var csP = rol === 'front' ? paramsFront.cs : paramsCorp.cs;
        var cant = cantPiesa(sursa, cgP, csP);

        cant.pe_grosime.forEach(function (x) {
          var cheie = x.mm + '|' + (mat.tip === 'PAL' ? (mat.decorNume || mat.decor || '—') : '—');
          cantPe[cheie] = cantPe[cheie] || { mm: x.mm, decor: mat.tip === 'PAL' ? (mat.decorNume || mat.decor || '—') : '—', ml: 0 };
          cantPe[cheie].ml += x.ml;
        });

        return {
          id: 'c' + corp.id + 'p' + i,
          corpId: corp.id, corpNume: corp.name, corpPoz: pozCorp,
          cod: pozCorp + '.' + (i + 1),
          nume: p.nume, buc: p.buc,
          L: sursa.L, l: sursa.l, TL: sursa.TL, Tl: sursa.Tl,
          fibra: p.fibra, nota: p.nota || '',
          material: mat, cant: cant, rol: rol,
          cnc: !!polyPiesa(p)
        };
      });

      var fero = feronerie(params, resCorp, sist);
      fero.forEach(function (f) { pune(feroTotal, f.nume, f.qty, f.um, f.obs); });

      /* jocul cutiei de sertar trebuie să fie cel al glisierei alese */
      if (+params.nSer > 0 && sist.glisiere && sist.glisiere.jocPeParte != null &&
          Math.abs(+params.jg - sist.glisiere.jocPeParte) > 0.1) {
        avertismenteComanda.push('„' + corp.name + '”: cutiile de sertar sunt calculate cu joc ' +
          params.jg + ' mm pe parte, dar ' + sist.glisiere.nume + ' cere ' +
          sist.glisiere.jocPeParte + ' mm. Schimbă jocul în corp sau glisiera pe comandă.');
      }

      resCorp.P.forEach(function (p) {
        cncPiesa(p, params, { id: corp.id, nume: corp.name }).forEach(function (x) { cnc.push(x); });
      });

      toateP = toateP.concat(piese);
      corpuriOut.push({
        id: corp.id, nume: corp.name, poz: pozCorp, params: params, res: resCorp,
        piese: piese, feronerie: fero, avertismente: resCorp.warn,
        materialCorp: matCorp, materialFront: matFront,
        dimensiuni: (params.tip === 'colt-L' || params.tip === 'colt-diagonal')
          ? params.W + ' × ' + params.H + ' × ' + params.W2 + ' (colț)'
          : params.W + ' × ' + params.H + ' × ' + params.D,
        bucati: piese.reduce(function (s, p) { return s + p.buc; }, 0)
      });
    });

    var materiale = necesarPlaci(toateP, formate, optiuni);

    var cant = Object.keys(cantPe).map(function (k) {
      var x = cantPe[k];
      var ml = r2(x.ml);
      return {
        mm: x.mm, decor: x.decor, ml: ml,
        cuAdaos: r2(ml * (1 + adaos / 100)),
        role: Math.ceil(ml * (1 + adaos / 100) / 50)
      };
    }).sort(function (a, b) { return a.mm - b.mm || String(a.decor).localeCompare(String(b.decor), 'ro'); });

    return {
      comanda: comanda,
      corpuri: corpuriOut,
      piese: toateP,
      materiale: materiale,
      formate: formateAlese(formate),
      cant: {
        adaosPct: adaos,
        linii: cant,
        total: r2(cant.reduce(function (s, x) { return s + x.ml; }, 0)),
        totalCuAdaos: r2(cant.reduce(function (s, x) { return s + x.cuAdaos; }, 0))
      },
      feronerie: feroTotal.sort(function (a, b) { return a.nume.localeCompare(b.nume, 'ro'); }),
      sistemFeronerie: sist,
      cnc: cnc,
      avertismente: avertismenteComanda,
      totaluri: {
        corpuri: corpuriOut.length,
        randuri: toateP.length,
        bucati: toateP.reduce(function (s, p) { return s + p.buc; }, 0),
        coli: materiale.reduce(function (s, m) { return s + m.coliIntregi; }, 0),
        avertismente: corpuriOut.reduce(function (s, c) { return s + c.avertismente.length; }, 0)
      }
    };
  }

  /* ---------- planșa CNC ---------- */

  function planseCnc(item) {
    if (!item.poly) return '';
    var b = item.bounds;
    var W = b.x1 - b.x0, H = b.y1 - b.y0;
    var pad = Math.max(W, H) * 0.18;
    var fs = Math.max(W, H) / 26;
    var o = [];

    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="cnc-gabarit"/>');
    o.push('<polygon points="' + item.poly.map(function (p) {
      return (p[0] - b.x0) + ',' + (H - (p[1] - b.y0));
    }).join(' ') + '" class="cnc-piesa"/>');

    item.muchii.forEach(function (m) {
      o.push('<line x1="' + (m.de_la[0] - b.x0) + '" y1="' + (H - (m.de_la[1] - b.y0)) +
             '" x2="' + (m.la[0] - b.x0) + '" y2="' + (H - (m.la[1] - b.y0)) + '" class="cnc-cant"/>');
      var mx = (m.de_la[0] + m.la[0]) / 2 - b.x0, my = H - ((m.de_la[1] + m.la[1]) / 2 - b.y0);
      o.push('<text x="' + mx + '" y="' + (my - fs * 0.5) + '" class="cnc-cota" ' +
             'text-anchor="middle" font-size="' + fs + '">' + r1(m.lung) + '</text>');
    });

    o.push('<text x="' + (W / 2) + '" y="' + (-pad * 0.35) + '" text-anchor="middle" ' +
           'font-size="' + fs + '" class="cnc-cota">' + r1(W) + ' mm</text>');
    o.push('<text x="' + (-pad * 0.4) + '" y="' + (H / 2) + '" text-anchor="middle" ' +
           'font-size="' + fs + '" class="cnc-cota" transform="rotate(-90 ' + (-pad * 0.4) + ' ' + (H / 2) + ')">' +
           r1(H) + ' mm</text>');

    return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) +
           '" class="cnc-svg" preserveAspectRatio="xMidYMid meet" role="img" ' +
           'aria-label="Planșă ' + item.piesa + '">' + o.join('') + '</svg>';
  }

  /* ---------- încadrarea în coală ---------- */

  function planColi(bin, material) {
    var W = bin.sheet.w, H = bin.sheet.h;
    var pad = Math.max(W, H) * 0.05;
    var fs = Math.max(W, H) / 46;
    var o = [];

    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="coala-fond" ' +
           (material && material.hex ? 'style="fill:' + material.hex + '"' : '') + '/>');

    bin.placements.forEach(function (pl) {
      var p = pl.piece;
      o.push('<rect x="' + pl.x + '" y="' + pl.y + '" width="' + pl.w + '" height="' + pl.h +
             '" class="coala-piesa"/>');

      var vertical = pl.h > pl.w * 1.3;
      var cx = pl.x + pl.w / 2, cy = pl.y + pl.h / 2;
      var latime = vertical ? pl.w : pl.h;
      var lung = vertical ? pl.h : pl.w;
      if (latime < 70 || lung < 130) return;

      var marime = Math.max(fs * 0.8, Math.min(fs * 1.6, latime / 3.4));
      var tr = vertical ? ' transform="rotate(-90 ' + cx + ' ' + cy + ')"' : '';
      o.push('<g' + tr + ' text-anchor="middle" class="coala-text">');
      o.push('<text x="' + cx + '" y="' + (cy - marime * 0.15) + '" font-size="' + marime +
             '" font-weight="600">' + p.label + '</text>');
      if (latime > 110) {
        o.push('<text x="' + cx + '" y="' + (cy + marime) + '" font-size="' + (marime * 0.8) + '">' +
               Math.round(pl.w) + '×' + Math.round(pl.h) + (pl.rotated ? ' ⟲' : '') + '</text>');
      }
      o.push('</g>');
    });

    (bin.offcuts || []).forEach(function (off) {
      o.push('<rect x="' + off.x + '" y="' + off.y + '" width="' + off.w + '" height="' + off.h +
             '" class="coala-rest"/>');
      if (off.w > 260 && off.h > 150) {
        o.push('<text x="' + (off.x + off.w / 2) + '" y="' + (off.y + off.h / 2) +
               '" text-anchor="middle" dominant-baseline="central" font-size="' + fs +
               '" class="coala-text">rest ' + Math.round(off.w) + '×' + Math.round(off.h) + '</text>');
      }
    });

    return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) +
           '" class="coala-svg" preserveAspectRatio="xMidYMid meet" role="img" ' +
           'aria-label="Încadrare coală ' + W + '×' + H + '">' + o.join('') + '</svg>';
  }

  return {
    raport: raport,
    feronerie: feronerie,
    materialPiesa: materialPiesa,
    rolPiesa: rolPiesa,
    cantPiesa: cantPiesa,
    muchiiFrontale: muchiiFrontale,
    necesarPlaci: necesarPlaci,
    planseCnc: planseCnc,
    planColi: planColi,
    FORMATE: FORMATE,
    COALA: COALA
  };
});
