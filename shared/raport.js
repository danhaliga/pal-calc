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
  /* Jumătățile și sferturile NU sunt jumătățile aritmetice ale colii. Din 2070
     nu scoți două bucăți de 1035: pânza și spălarea muchiei mănâncă diferența.
     Valorile de mai jos sunt cele declarate de atelier în fișierele Holzma
     (.saw) ale lucrărilor reale — 2800×1030 și 1390×1030 — nu 1035 și 1400.
     `frac` rămâne fracțiunea de coală întreagă plătită, nu raportul de arii. */
  var FORMATE = {
    'intreaga': { id: 'intreaga', w: 2800, h: 2070, frac: 1 },
    'jum-lat':  { id: 'jum-lat',  w: 1390, h: 2070, frac: 0.5 },
    'jum-lung': { id: 'jum-lung', w: 2800, h: 1030, frac: 0.5 },
    'sfert':    { id: 'sfert',    w: 1390, h: 1030, frac: 0.25 }
  };

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  /* ---------- rolul și materialul unei piese ---------- */

  /* Rolul vine de-a gata pe piesă, din cheia ei; funcția rămâne pentru
     piesele vechi, salvate înainte de a avea chei. */
  function rolPiesa(p) {
    if (p && p.rol) return p.rol;
    return PalCalc.rolPiesa(p && p.cheie);
  }

  function palMaterial(m, gros, t_) {
    var decor = m && (m.decor_cod || m.decor_nume) ? (m.decor_cod || m.decor_nume)
                                                   : t_('mat.faraDecor');
    var eticheta = t_('mat.pal', { mm: gros });
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

  function pflMaterial(gros, t_) {
    return {
      key: 'PFL|' + gros, tip: 'PFL', gros: gros, nume: t_('mat.pfl', { mm: gros }),
      brand: null, decor: null, decorNume: null, hex: null, matId: null
    };
  }

  function materialPiesa(p, c, mats, tr) {
    var t_ = PalCalc.traducator(tr);
    var rol = rolPiesa(p);
    if (rol === 'pfl') return pflMaterial(3, t_);
    if (rol === 'spate') {
      var tp = +c.tp;
      return tp >= 8 ? palMaterial(mats.corp, tp, t_) : pflMaterial(tp, t_);
    }
    if (rol === 'sertar') return palMaterial(mats.sertar || mats.corp, +c.ts, t_);
    if (rol === 'front') return palMaterial(mats.front || mats.corp, +c.t, t_);
    return palMaterial(mats.corp, +c.t, t_);
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
      /* `polySectiune`: desenul e SECȚIUNEA piesei văzută din față (grosime ×
         înălțime) — montantul, lateralele și tavanul de sub scară — nu fața
         ei. Nu e contur de decupat; la ele se taie capetele înclinat. */
      if (p.boxes[i].polyFata && !p.boxes[i].polySectiune) return p.boxes[i].polyFata;
    }
    return null;
  }

  /* piesele tăiate la unghi (laturile unui corp atipic) cer și ele CNC */
  function areUnghiuri(p) {
    return (p.cheie === 'panouLatura' && p.notaCheie === 'taiereLaUnghi') ||
      p.cheie === 'tavanPanta' || p.notaCheie === 'lateralaSusInclinata' ||
      p.notaCheie === 'montantSubPanta';
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
    /* Spatele (PFL sau PAL) decupat după contur nu se cantuiește: stă
       lipit de perete, nu are muchii la vedere. */
    var rol = rolPiesa(p);
    var faraCant = rol === 'spate' || rol === 'pfl';

    if (poly && !faraCant) {
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

  function cncPiesa(p, c, corp, tr) {
    var t_ = PalCalc.traducator(tr);
    var out = [];
    var poly = polyPiesa(p);

    /* laturile unui corp atipic: se taie la unghi la ambele capete */
    if (areUnghiuri(p)) {
      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: t_('cnc.taiereUnghi'), gabarit: { L: p.TL, l: p.Tl },
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
          tip: t_('cnc.decupareContur'),
          gabarit: { L: p.TL, l: p.Tl },
          poly: poly, bounds: bb, muchii: muchiiFrontale(poly),
          detalii: t_('cnc.detDecupareContur',
                      { a: r1(bb.x1 - bb.x0), b: r1(bb.y1 - bb.y0) })
        });
        return out;
      }

      /* un contur care e chiar dreptunghiul de gabarit nu are ce prelucra */
      if (muchii.length) {
        if (diagonal) {
          detalii = t_('cnc.detTaiere45', { diag: r1(muchii[0].lung) });
        } else {
          var cx = muchii[0].la[0], cy = muchii[0].la[1];
          detalii = t_('cnc.detDecupajColt', {
            a: r1(b.x1 - cx), b: r1(b.y1 - cy),
            muchii: muchii.map(function (m) { return r1(m.lung); }).join(' + ')
          });
        }

        out.push({
          corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
          tip: diagonal ? t_('cnc.taiere45') : t_('cnc.decupajColt'),
          gabarit: { L: p.TL, l: p.Tl },
          poly: poly, bounds: b, muchii: muchii, detalii: detalii
        });
      }
    }

    if ((c.spate === 'nut' || c.spate === 'pal') &&
        (p.cheie === 'laterala' || p.cheie === 'blat' || p.cheie === 'fund')) {
      out.push({
        corp: corp.nume, corpId: corp.id, piesa: p.nume, buc: p.buc,
        tip: t_('cnc.nutSpate'), gabarit: { L: p.TL, l: p.Tl },
        poly: null, bounds: null, muchii: [],
        detalii: t_('cnc.detNut', { lat: +c.tp, ad: PalCalc.NUT_AD, off: PalCalc.NUT_OFF })
      });
    }
    return out;
  }

  /* ---------- feronerie ---------- */

  /* Feroneria unui corp, după sistemul ales pe comandă. */
  function feronerie(params, res, sistem, tr) {
    var t_ = PalCalc.traducator(tr);
    var c = params;
    var nUsi = +c.nUsi, nSer = +c.nSer, nPol = +c.nPol;
    var s = sistem || PalFeronerie.sistem(null, t_);
    var items = [];
    var pune = function (nume, qty, um, obs) {
      if (qty <= 0) return;
      var gasit = items.filter(function (x) { return x.nume === nume; })[0];
      if (gasit) { gasit.qty += qty; return; }
      items.push({ nume: nume, qty: qty, um: t_('comun.' + (um || 'buc')), obs: obs || '' });
    };
    var art = function (cheie) { return t_('fero.art.' + cheie); };
    var rotunjeste = function () {
      items.forEach(function (x) { x.qty = Math.ceil(x.qty); });
      return items;
    };

    /* ---- balamale ---- */
    var usiPiese = res.P.filter(function (p) {
      return p.cheie === 'usa' || p.cheie === 'usaDiagonala' ||
             p.cheie === 'usaBrat1' || p.cheie === 'usaBrat2';
    });
    var totalBalamale = 0, perUsa = 0;
    /* Ușile glisante n-au balamale: merg pe șine. Se cumpără sistemul. */
    if (c.montaj === 'glisant') {
      var nGl = usiPiese.reduce(function (s, p) { return s + p.buc; }, 0) +
        (res.deComandat || []).reduce(function (s, u) { return s + (u.fel === 'usaRamaAlu' ? u.buc : 0); }, 0);
      if (nGl) pune(art('sistemGlisant'), 1, 'set', t_('fero.art.obsSistemGlisant', { n: nGl, lat: +c.W }));
      usiPiese = [];
    }
    usiPiese.forEach(function (p) {
      var n = PalCalc.balamale(p.L);
      totalBalamale += n * p.buc;
      perUsa = Math.max(perUsa, n);
    });
    if (totalBalamale && s.balama && s.balama.id !== 'fara') {
      var numeBal = t_('fero.balama.' + s.balama.id + '.nume');
      var codBal = s.balama.coduri && s.balama.coduri[String(c.balama)];
      pune(codBal ? t_('fero.art.balamaCod', { nume: numeBal, cot: c.balama, cod: codBal })
                  : t_('fero.art.balamaCu', { nume: numeBal, cot: c.balama }),
           totalBalamale, 'buc', t_('fero.art.obsPeUsa', { n: perUsa }));
      if (s.balama.placaCod) pune(t_('fero.art.placaBalama', { cod: s.balama.placaCod }), totalBalamale);
      (s.balama.consumabile || []).forEach(function (x) {
        pune(art(x.art), totalBalamale * x.peBalama);
      });
    }
    /* Balamaua de carte cuplează două fronturi între ele. Fără fronturi n-are
       ce cupla, deci se uită de ea — de-aia întrebarea e câte canaturi s-au
       tăiat, nu câte s-au cerut. */
    if (c.tip === 'colt-L' && nUsi >= 2 && usiPiese.length) {
      pune(art('balamaCarte'), 1, 'buc', t_('fero.art.obsCupleazaFronturi'));
    }

    /* ---- coșul Jolly ----

       Se cumpără coșul, după lățimea corpului. Frontul lui se taie din PAL
       ca oricare altul, dar se prinde pe cadrul coșului: n-are balamale,
       și nu le primește — frontul nu se cheamă „ușă" în lista de piese. */
    if (+c.jolly && (c.tip || 'drept') === 'drept') {
      pune(t_('fero.art.cosJolly', { lat: +c.W }), 1, 'buc', t_('fero.art.obsCosJolly'));
    }

    /* ---- uși de vitrină: ramă de aluminiu cu sticlă, cumpărate ----

       Nu se taie, deci nu stau în lista de piese: se comandă gata la cota
       finită a ușii. Balamaua e alta decât cea de PAL — la rama de
       aluminiu cupa nu se frezează în placă — deci are rândul ei. */
    var usiAlu = (res.deComandat || []).filter(function (x) { return x.fel === 'usaRamaAlu'; });
    var balAlu = 0, perUsaAlu = 0;
    usiAlu.forEach(function (u) {
      pune(t_('fero.art.usaRamaAlu', { h: u.H, l: u.L }), u.buc, 'buc', t_('fero.art.obsUsaRamaAlu'));
      var n = PalCalc.balamale(u.H);
      balAlu += n * u.buc;
      perUsaAlu = Math.max(perUsaAlu, n);
    });
    if (balAlu && s.balama && s.balama.id !== 'fara' && c.montaj !== 'glisant') {
      pune(art('balamaRamaAlu'), balAlu, 'buc', t_('fero.art.obsPeUsa', { n: perUsaAlu }));
    }

    /* ---- sertare ---- */
    if (nSer > 0 && s.glisiere && s.glisiere.id !== 'fara') {
      var lg = +c.lg;
      if (!lg) lg = Math.floor((res.Dint - 10) / 50) * 50;
      var numeGl = t_('fero.glisiere.' + s.glisiere.id + '.nume');
      var codGl = s.glisiere.coduri && s.glisiere.coduri[lg];
      pune(codGl ? t_('fero.art.glisieraCod', { nume: numeGl, mm: lg, cod: codGl })
                 : t_('fero.art.glisieraCu', { nume: numeGl, mm: lg }),
           nSer, 'set', codGl ? t_('fero.art.obsPeSet') : t_('fero.art.obsFaraCod'));
      pune(art('surubGlisiere'), nSer * (s.glisiere.suruburiPeSet || 8));
    }

    /* Polițele se fac pe compartiment, deci numărul lor se înmulțește cu
       numărul de compartimente — la fel și suporții, câte patru pe poliță. */
    var compartimente = (+c.nDsp || 0) + 1;
    if (nPol > 0) pune(art('suportPolita'), nPol * compartimente * 4);

    /* ---- asamblarea carcasei ----
       Patru îmbinări între orizontale și laterale, plus câte două pentru
       fiecare montant: se prinde de blat și de fund exact ca o laterală
       (aceleași dibluri în cant și aceleași excentrice la capete). */
    var imbinari = 4 + 2 * (+c.nDsp || 0);
    (s.asamblare.pePiesa || []).forEach(function (x) {
      pune(art(x.art), imbinari * x.buc, 'buc',
           x.buc > 1 ? t_('fero.art.obsPeImbinare', { n: x.buc }) : t_('fero.art.obsUnaPeImbinare'));
    });

    /* ---- spate ---- */
    if (c.spate === 'aplicat') {
      var perim = 2 * ((+c.W) + (+c.H)) / 1000;
      pune(art('holsurubSpate'), Math.ceil(perim * 1000 / 150), 'buc', t_('fero.art.obsLa150'));
    }

    /* ---- suspensii, doar la corpurile subțiri, care se prind pe perete ---- */
    if (s.suspensii && +c.D <= 450 && c.tip !== 'atipic') {
      pune(t_('fero.suspensii.nume'), s.suspensii.peCorp, 'buc', t_('fero.art.obsPeCorp'));
      (s.suspensii.consumabile || []).forEach(function (x) {
        if (x.peSuspensie) pune(art(x.art), s.suspensii.peCorp * x.peSuspensie);
      });
    }

    /* ---- picioare ----

       Numai la corpul care stă pe podea fără soclu: cu soclu, stă pe el.
       Câte picioare și câte cleme — vezi PICIOARE în shared/feronerie.js. */
    var lungPlinta = lungimePlinta(c, res);
    if (lungPlinta > 0) {
      var pic = s.picioare || PalFeronerie.PICIOARE;
      var lat = Math.max(+c.W || 0, c.tip === 'colt-L' || c.tip === 'colt-diagonal' ? +c.W2 || 0 : 0);
      var nPic = lat > pic.latDeLa ? pic.peCorpLat : pic.peCorp;
      var plinta = s.plinta && s.plinta.id !== 'fara' ? s.plinta : null;
      /* tipul de picior ales pe corp, din catalogul Häfele (shared/calc.js) */
      var tp = (res && res.picior) || Object.assign({ id: PalCalc.PICIOR_IMPLICIT }, PalCalc.PICIOARE_HAFELE[PalCalc.PICIOR_IMPLICIT]);
      var fam = t_('fero.piciorFam.' + tp.fam);
      pune(t_('fero.art.piciorTip', { fam: fam, h: tp.h, min: tp.min, max: tp.max, cod: tp.cod }), nPic, 'buc',
           t_('fero.art.obsPicioare', { n: pic.peCorp, m: pic.peCorpLat, lat: pic.latDeLa }));
      if (tp.suport) pune(t_('fero.art.suportPicior', { fam: fam, cod: tp.suport }), nPic, 'buc');
      if (plinta && !tp.vizibil) {
        pune(tp.clema ? t_('fero.art.clemaPlintaCod', { cod: tp.clema }) : art('clemaPlinta'), nPic / 2, 'buc',
             t_('fero.art.obsClemaPlinta'));
      }
    }

    /* ---- fronturi ----

       Mânerul se prinde ÎN front, deci se numără fronturile tăiate, nu
       `nUsi + nSer`. Nu e același lucru: la o coloană de cuptor cele două
       uși cerute ies în două zone, adică patru canaturi, iar la o comandă
       fără fronturi nu iese niciunul. */
    var cateFronturi = res.P.reduce(function (s, p) {
      return s + (rolPiesa(p) === 'front' ? p.buc : 0);
    }, 0) + usiAlu.reduce(function (s, u) { return s + u.buc; }, 0);
    /* Fără mâner nu se cumpără niciunul: la push-to-open, la profil gola sau
       la prinderea frezată în front nu intră nimic în listă. */
    if (!(+c.maner === 0)) {
      var mn = s.maner;
      var interax = Math.round(+c.manerL || 128);
      var codMn = mn && mn.coduri && mn.coduri[interax];
      pune(mn && mn.id !== 'oarecare'
             ? (codMn ? t_('fero.art.manerCod', { nume: t_('fero.maner.' + mn.id + '.nume'), l: interax, cod: codMn })
                      : t_('fero.art.manerFaraCod', { nume: t_('fero.maner.' + mn.id + '.nume'), l: interax }))
             : art('maner'),
           cateFronturi, 'buc', mn && mn.id !== 'oarecare' && !codMn ? t_('fero.art.obsFaraCod') : '');
      pune(art('surubManer'), cateFronturi * 2);
    }

    return rotunjeste();
  }

  /* Cât din fața corpului acoperă plinta, în mm. 0 = corpul n-are plintă
     (e suspendat, are soclu, sau n-are picioare). Plinta merge pe linia
     fronturilor: la colțul în L pe cele două brațe, la cel pe diagonală pe
     diagonală, la colțul orb numai pe partea care se vede — restul stă
     sub corpul vecin, care are plinta lui. */
  /* „ · H 720 + picioare 100 = 820" sau „ · fără picioare" — al doilea
     doar la corpurile de pe podea (jos, coloane), unde contează. */
  /* plinta comenzii trebuie să încapă în reglajul picioarelor alese */
  function avertPlinta(res, sis, t_) {
    var pl = sis && sis.plinta;
    if (!res || !res.picior || res.picior.vizibil || !pl || pl.id === 'fara' || !pl.h) return [];
    if (pl.h >= res.picior.min && pl.h <= res.picior.max) return [];
    return [t_('avert.plintaPicior', { plinta: pl.h, min: res.picior.min, max: res.picior.max })];
  }

  function picioareText(c, res, t_) {
    if (res && res.picior) {
      return ' · ' + t_('comun.dimPicioare', { h: c.H, p: res.picior.h, t: res.inaltimeTotala });
    }
    var podea = c.familie === 'bucatarie-jos' || c.familie === 'bucatarie-inalt' ||
                (!c.familie && c.tip === 'drept' && +c.D >= 450 && !(+c.soclu > 0));
    return podea && !(res && +res.soclu > 0) ? ' · ' + t_('comun.dimFaraPicioare') : '';
  }

  function lungimePlinta(c, res) {
    /* Soclul care chiar s-a pus (din calcul), nu cel cerut: un soclu cerut
       la o construcție care nu-l primește lasă corpul pe picioare. */
    var areSoclu = res ? +res.soclu > 0 : +c.soclu > 0;
    if (!+c.picioare || areSoclu) return 0;
    if (c.tip === 'atipic' || c.tip === 'piesa') return 0;
    var k = res && res.colt;
    if (c.tip === 'colt-L') return k ? k.brA + k.brB : 0;
    if (c.tip === 'colt-diagonal') return k ? k.diag : 0;
    if (c.tip === 'colt-orb') return Math.max(0, (+c.W || 0) - (+c.orb || 0));
    return +c.W || 0;
  }

  /* ---------- croirea în coli ---------- */

  function numeFormat(id, t_) { return t_('format.' + id); }

  function formateAlese(lista, t_) {
    var ids = (lista && lista.length) ? lista : ['intreaga'];
    return ids.map(function (id) {
      var f = FORMATE[id];
      return f ? (t_ ? Object.assign({ nume: numeFormat(id, t_) }, f) : f) : null;
    }).filter(Boolean);
  }

  function necesarPlaci(piese, formate, optiuni) {
    var t_ = PalCalc.traducator(optiuni && optiuni.t);
    var grupe = {};
    piese.forEach(function (p) {
      var k = p.material.key;
      (grupe[k] = grupe[k] || { info: p.material, piese: [] }).piese.push(p);
    });

    var tipuriColi = formateAlese(formate, t_);

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
          return { format: Object.assign({ nume: numeFormat(id, t_) }, FORMATE[id]),
                   n: folosite[id] };
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

    var t_ = PalCalc.traducator(optiuni && optiuni.t);
    var sist = PalFeronerie.sistem(comanda.feronerie, t_);

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

      var resCorp = PalCalc.calc(paramsCorp, t_);
      var acelasiCant = paramsCorp.cg === paramsFront.cg && paramsCorp.cs === paramsFront.cs;
      var resFront = acelasiCant ? resCorp : PalCalc.calc(paramsFront, t_);

      /* Fără fronturi, materialul de fronturi nu se taie: o placă de altă
         grosime pusă pe rândul lui nu mai supără pe nimeni. */
      if (!+params.faraFront && matFront && matCorp && +matFront.pal_mm !== +matCorp.pal_mm) {
        avertismenteComanda.push(t_('avert.frontAltPal', {
          corp: corp.name, front: matFront.pal_mm, corpMm: matCorp.pal_mm
        }));
      }

      var pozCorp = corp.poz || (idx + 1);
      var piese = resCorp.P.map(function (p, i) {
        var rol = rolPiesa(p);
        var sursa = (rol === 'front' && !acelasiCant) ? resFront.P[i] : p;
        var mat = materialPiesa(p, params, {
          corp: matCorp, front: matFront, sertar: mats.sertar || matCorp
        }, t_);
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
          cheie: p.cheie, nume: p.nume, buc: p.buc,
          L: sursa.L, l: sursa.l, TL: sursa.TL, Tl: sursa.Tl,
          fibra: p.fibra, fibraText: p.fibraText, nota: p.nota || '',
          material: mat, cant: cant, rol: rol,
          cnc: !!polyPiesa(p)
        };
      });

      var fero = feronerie(params, resCorp, sist, t_);
      fero.forEach(function (f) { pune(feroTotal, f.nume, f.qty, f.um, f.obs); });

      /* jocul cutiei de sertar trebuie să fie cel al glisierei alese */
      if (+params.nSer > 0 && sist.glisiere && sist.glisiere.jocPeParte != null &&
          Math.abs(+params.jg - sist.glisiere.jocPeParte) > 0.1) {
        avertismenteComanda.push(t_('avert.jocGlisiera', {
          corp: corp.name, jg: params.jg,
          glisiera: t_('fero.glisiere.' + sist.glisiere.id + '.nume'),
          cerut: sist.glisiere.jocPeParte
        }));
      }

      resCorp.P.forEach(function (p) {
        cncPiesa(p, params, { id: corp.id, nume: corp.name }, t_)
          .forEach(function (x) { cnc.push(x); });
      });

      toateP = toateP.concat(piese);
      corpuriOut.push({
        id: corp.id, nume: corp.name, poz: pozCorp, params: params, res: resCorp,
        piese: piese, feronerie: fero,
        avertismente: resCorp.warn.concat(avertPlinta(resCorp, sist, t_)),
        materialCorp: matCorp, materialFront: matFront,
        dimensiuni: ((params.tip === 'colt-L' || params.tip === 'colt-diagonal')
          ? params.W + ' × ' + params.H + ' × ' + params.W2 + ' (' + t_('comun.colt') + ')'
          : params.W + ' × ' + params.H + ' × ' + params.D) + picioareText(params, resCorp, t_),
        bucati: piese.reduce(function (s, p) { return s + p.buc; }, 0)
      });
    });

    /* ---- plinta de aluminiu, pe toată comanda ----

       O bară lungă pe toată bucătăria, nu o bucată pe corp: se adună
       lungimea din fața tuturor corpurilor pe picioare și se cumpără bare
       întregi. Colțarele, îmbinările și capacele de capăt depind de cum se
       așază corpurile în cameră, deci nu se numără aici — se spune. */
    if (sist.plinta && sist.plinta.id !== 'fara') {
      var mmPlinta = 0, corpuriPlinta = 0;
      corpuriOut.forEach(function (co) {
        var l = lungimePlinta(co.params, co.res);
        if (l > 0) { mmPlinta += l; corpuriPlinta++; }
      });
      if (mmPlinta > 0) {
        pune(feroTotal, t_('fero.art.plintaBara', { h: sist.plinta.h, bara: sist.plinta.bara }),
             Math.ceil(mmPlinta / sist.plinta.bara), t_('comun.buc'),
             t_('fero.art.obsPlinta', { mm: Math.round(mmPlinta), n: corpuriPlinta }));
      }
    }

    var materiale = necesarPlaci(toateP, formate, Object.assign({}, optiuni, { t: t_ }));

    var cant = Object.keys(cantPe).map(function (k) {
      var x = cantPe[k];
      var ml = r2(x.ml);
      return {
        mm: x.mm, decor: x.decor, ml: ml,
        cuAdaos: r2(ml * (1 + adaos / 100)),
        role: Math.ceil(ml * (1 + adaos / 100) / 50)
      };
    }).sort(function (a, b) {
      return a.mm - b.mm || String(a.decor).localeCompare(String(b.decor), t_.lang);
    });

    return {
      comanda: comanda,
      corpuri: corpuriOut,
      piese: toateP,
      materiale: materiale,
      formate: formateAlese(formate, t_),
      cant: {
        adaosPct: adaos,
        linii: cant,
        total: r2(cant.reduce(function (s, x) { return s + x.ml; }, 0)),
        totalCuAdaos: r2(cant.reduce(function (s, x) { return s + x.cuAdaos; }, 0))
      },
      feronerie: feroTotal.sort(function (a, b) { return a.nume.localeCompare(b.nume, t_.lang); }),
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
    lungimePlinta: lungimePlinta,
    feronerie: feronerie,
    materialPiesa: materialPiesa,
    rolPiesa: rolPiesa,
    cantPiesa: cantPiesa,
    muchiiFrontale: muchiiFrontale,
    necesarPlaci: necesarPlaci,
    planseCnc: planseCnc,
    planColi: planColi,
    FORMATE: FORMATE,
    formate: function (tr) {
      var t_ = PalCalc.traducator(tr);
      var out = {};
      Object.keys(FORMATE).forEach(function (id) {
        out[id] = Object.assign({ nume: numeFormat(id, t_) }, FORMATE[id]);
      });
      return out;
    },
    COALA: COALA
  };
});
