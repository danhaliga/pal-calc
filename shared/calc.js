/* ============================================================
   Motorul de calcul pentru corpuri de mobila din PAL.
   Portat identic (ca logica) din calculator-debitare.html.

   Acelasi fisier ruleaza in doua locuri:
     - pe server  -> require('../shared/calc')            (CommonJS)
     - in browser -> <script src="/shared/calc.js">       (window.PalCalc)

   paramsSchema (zod) exista doar pe server; in browser ramane null,
   pentru ca zod nu se incarca in pagina.
   ============================================================ */
(function (root, factory) {
  var api = factory(
    typeof module === 'object' && module.exports ? require('./i18n') : root.PalI18n
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalCalc = api;
})(typeof self !== 'undefined' ? self : this, function (PalI18n) {
  'use strict';

  var NUT_OFF = 10;      /* distanta nutului fata de spatele corpului */
  var NUT_AD = 8;        /* adancimea nutului */
  var PFL_SERTAR = 3;    /* grosimea fundului de sertar */

  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* Cât se scade din cotă pentru o bandă de cant, la debitare.

     NU e grosimea benzii. Măsurat pe 96 de piese din patru lucrări reale
     (fișier Holzma .saw față de program WoodWOP .mpr, aceeași piesă), plus
     banda de 1 mm, confirmată de atelier:

         bandă 2 mm    ->  scade 1.5 mm     măsurat
         bandă 1 mm    ->  scade 0.5 mm     spus de atelier
         bandă 0.8 mm  ->  scade 0          măsurat
         bandă 0.4 mm  ->  scade 0          măsurat

     Banda subțire intră în toleranța ferăstrăului și nimeni n-o scade; de la
     1 mm în sus se scade grosimea minus o jumătate de milimetru, cât se duce
     pe frezarea muchiei și pe linia de clei. De asta „cotă de tăiere = cotă
     finită − grosimea cantului" dă piese mai mici decât trebuie.

     Pragul e 0.8 și nu 1 fiindcă banda de 0.8 nu scade nimic, iar cea de 1 mm
     scade: limita trece exact între ele. Atelierul folosește doar 0.4, 0.8, 1
     și 2 — de 3 mm nu se folosește, deci acolo formula n-a fost verificată
     niciodată pe ceva real.

     PRAG    banda până în el, inclusiv, nu schimbă cota de tăiere
     REZERVA cât absoarbe frezarea și cleiul, peste prag */
  var PRAG_CANT = 0.8;
  var REZERVA_CANT = 0.5;

  function reducereCant(grosime, prag, rezerva) {
    var g = +grosime || 0;
    var p = (prag == null) ? PRAG_CANT : +prag;
    var rz = (rezerva == null) ? REZERVA_CANT : +rezerva;
    if (g <= p) return 0;
    return Math.max(0, g - rz);
  }
  var fmt = function (v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); };

  function defaults(tr) {
    return {
      nume: traducator(tr)('modele.corpImplicit'), W: 800, H: 720, D: 560, constr: 'intre',
      tip: 'drept', W2: 900, orb: 550, contur: [],
      t: 18, cg: 2, cs: 0.4, spate: 'aplicat', tp: 3,
      nUsi: 2, montaj: 'aplicat', balama: '0', rm: 1.5, ri: 3, rinc: 2,
      nPol: 1, jp: 1, rp: 20, nDsp: 0,
      nSer: 0, hFront: 150, hCutie: 100, jg: 12.5, ts: 16, lg: '',
      pragCant: PRAG_CANT, rezervaCant: REZERVA_CANT
    };
  }

  /* tipurile de corp pe care le stie calculul */
  var TIPURI = ['drept', 'colt-orb', 'colt-L', 'colt-diagonal', 'atipic'];
  function esteColt(tip) { return tip === 'colt-L' || tip === 'colt-diagonal'; }

  /* ---------- conturul unui corp atipic ----------
     Se merge din latura in latura: lungimea laturii, apoi unghiul interior
     din varful unde se intalneste cu urmatoarea. Conturul e bun cand se inchide. */

  /* Fără un traducător dat, textele ies în româna implicită. */
  function traducator(t) {
    if (typeof t === 'function') return t;
    return PalI18n.creeaza(PalI18n.IMPLICITA);
  }

  /* Direcția unei laturi: întoarce cheia și, la laturile înclinate, unghiul.
     Textul se scrie abia la afișare, în limba paginii. */
  function directie(dir) {
    var d = ((dir % 360) + 360) % 360;
    if (Math.abs(d - 0) < 0.5) return { cheie: 'jos' };
    if (Math.abs(d - 90) < 0.5) return { cheie: 'dreapta' };
    if (Math.abs(d - 180) < 0.5) return { cheie: 'sus' };
    if (Math.abs(d - 270) < 0.5) return { cheie: 'stanga' };
    return { cheie: 'inclinata', grade: r1(d) };
  }

  function numeDirectie(dir, t) {
    var d = directie(dir);
    return traducator(t)('directie.' + d.cheie, d.grade != null ? { grade: d.grade } : null);
  }

  function conturGeometrie(contur) {
    var laturi = [], pts = [], x = 0, y = 0, dir = 0;
    contur = (contur || []).filter(function (s) { return +s.lung > 0; });

    for (var i = 0; i < contur.length; i++) {
      var lung = +contur[i].lung;
      var unghi = +contur[i].unghi;
      var rad = dir * Math.PI / 180;
      var x2 = x + lung * Math.cos(rad);
      var y2 = y + lung * Math.sin(rad);

      pts.push([x, y]);
      laturi.push({
        idx: i, lung: r1(lung), dir: dir, directie: directie(dir),
        de_la: [x, y], la: [x2, y2],
        unghiEnd: unghi,
        unghiStart: +contur[(i - 1 + contur.length) % contur.length].unghi
      });

      x = x2; y = y2;
      dir = ((dir + 180 - unghi) % 360 + 360) % 360;
    }

    var eroare = Math.hypot(x, y);
    var sumaUnghiuri = contur.reduce(function (s, l) { return s + (+l.unghi); }, 0);

    /* aducem conturul in coordonate pozitive, cu originea in coltul stanga-jos */
    var minX = 0, minY = 0;
    pts.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); });
    var puncte = pts.map(function (p) { return [r1(p[0] - minX), r1(p[1] - minY)]; });
    laturi.forEach(function (l) {
      l.de_la = [r1(l.de_la[0] - minX), r1(l.de_la[1] - minY)];
      l.la = [r1(l.la[0] - minX), r1(l.la[1] - minY)];
    });

    var maxX = 0, maxY = 0;
    puncte.forEach(function (p) { maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });

    return {
      puncte: puncte, laturi: laturi,
      inchis: eroare < 1 && contur.length >= 3,
      eroare: r1(eroare),
      sumaUnghiuri: r1(sumaUnghiuri),
      sumaCeruta: contur.length >= 3 ? (contur.length - 2) * 180 : 0,
      W: r1(maxX), H: r1(maxY),
      nrLaturi: contur.length
    };
  }

  function conturImplicit(W, H) {
    return [
      { lung: W, unghi: 90 }, { lung: H, unghi: 90 },
      { lung: W, unghi: 90 }, { lung: H, unghi: 90 }
    ];
  }

  function balamale(h) { return h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5; }

  /* Rolul unei piese se ia din cheia ei, nu din text: așa rămâne același
     în toate limbile. */
  var ROL = {
    usa: 'front', usaDiagonala: 'front', usaBrat1: 'front', usaBrat2: 'front',
    frontSertar: 'front', frontAtipic: 'front',
    spateAtipic: 'spate', spatePerete1: 'spate', spatePerete2: 'spate',
    spateAplicat: 'spate', spateNut: 'spate',
    sertarLaterala: 'sertar', sertarFataSpate: 'sertar',
    sertarFund: 'pfl'
  };

  function rolPiesa(cheie) { return ROL[cheie] || 'corp'; }

  function calc(c, tr) {
    var t_ = traducator(tr);
    var W = +c.W, H = +c.H, D = +c.D, t = +c.t, cg = +c.cg, cs = +c.cs, tp = +c.tp;
    var rm = +c.rm, ri = +c.ri, rinc = +c.rinc, nUsi = +c.nUsi, nPol = +c.nPol, nSer = +c.nSer;
    var nDsp = +c.nDsp || 0;                /* montanți (despărțitori) în interior */
    var P = [], warn = [], avertismente = [];
    var aplicat = c.spate === 'aplicat';
    var zb = aplicat ? tp : 0;              /* unde incep piesele corpului pe adancime */
    var Dp = D - zb;                        /* adancimea pieselor corpului */
    var zin = aplicat ? tp : NUT_OFF + tp;  /* fata interioara a spatelui */
    var Dint = D - zin;                     /* adancime interioara utila */
    var Wint = W - 2 * t, Hint = H - 2 * t;
    var ev = function (v) { return v === 'g' ? cg : v === 's' ? cs : 0; };
    var red = function (v) { return reducereCant(ev(v), c.pragCant, c.rezervaCant); };

    /* O piesă ține cheia ei (stabilă, pentru potriviri și pentru raport) și
       numele scris în limba cerută. `nota` și `fibra` sunt tot chei. */
    var add = function (cheie, args, buc, L, l, cL1, cL2, cl1, cl2, fibra, nota, boxes) {
      P.push({
        cheie: cheie, args: args || null, rol: rolPiesa(cheie),
        nume: t_('piesa.' + cheie, args || null),
        buc: buc, L: r1(L), l: r1(l), c: [cL1, cL2, cl1, cl2],
        /* cL1/cL2 sunt muchiile paralele cu L, deci banda de pe ele îngroașă
           piesa pe l — și invers. Vezi comentariul de la reducereCant(). */
        TL: r1(L - red(cl1) - red(cl2)), Tl: r1(l - red(cL1) - red(cL2)),
        fibra: fibra, fibraText: t_('fibra.' + fibra),
        notaCheie: nota ? nota[0] : '', notaArgs: nota ? (nota[1] || null) : null,
        nota: nota ? t_('nota.' + nota[0], nota[1] || null) : '',
        boxes: boxes || []
      });
    };

    /* Avertismentele merg tot pe chei: textul se compune la afișare. */
    var avert = function (cheie, args) {
      var text = t_('avert.' + cheie, args || null);
      avertismente.push({ cheie: cheie, args: args || null, text: text });
      warn.push(text);
    };
    var bx = function (x, y, z, sx, sy, sz, f, ex, grp) {
      return { x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, f: f, ex: ex, grp: grp };
    };
    var F = function (o) {
      return Object.assign({ px: '-', nx: '-', py: '-', ny: '-', pz: '-', nz: '-' }, o);
    };
    /* panou cu contur poligonal in plan (blat/fund/polita de colt), extrudat pe verticala */
    var bp = function (x, y, z, poly, gros, ex, grp) {
      return { x: x, y: y, z: z, sx: 0, sy: gros, sz: 0, poly: poly,
               f: F({ py: 'f', ny: 'f' }), ex: ex, grp: grp };
    };

    /* ============ corp atipic: definit prin conturul văzut din față ============
       Fiecare latură a conturului devine un panou de adâncimea corpului, tăiat
       la unghi la ambele capete. Spatele și frontul se decupează după contur. */
    if (c.tip === 'atipic') {
      var g = conturGeometrie(c.contur && c.contur.length ? c.contur : conturImplicit(W, H));
      var Da = D;
      var FDa = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
      var usiA = [];

      if (!g.inchis) {
        avert('conturDeschis', { eroare: fmt(g.eroare), suma: fmt(g.sumaUnghiuri),
                                 laturi: g.nrLaturi, ceruta: fmt(g.sumaCeruta) });
      }
      if (g.nrLaturi < 3) {
        avert('conturPreaPutineLaturi');
      }

      /* panourile de pe laturi */
      g.laturi.forEach(function (lat, i) {
        var taiere = ['taiereLaUnghi', { a: fmt(r1(lat.unghiStart / 2)), b: fmt(r1(lat.unghiEnd / 2)) }];
        var mx = (lat.de_la[0] + lat.la[0]) / 2;
        var my = (lat.de_la[1] + lat.la[1]) / 2;

        add('panouLatura', { n: i + 1, latura: numeDirectie(lat.dir, t_) },
            1, lat.lung, Da, 'g', '-', '-', '-',
            'L', taiere,
            [{ x: mx - lat.lung / 2, y: my - t / 2, z: 0,
               sx: lat.lung, sy: t, sz: Da, f: F({ py: 'f', ny: 'f', pz: 'g' }),
               ex: [0, 0, 0], grp: 'corp',
               rz: lat.dir * Math.PI / 180 }]);
      });

      /* spatele și frontul, decupate după contur */
      if (c.spate !== 'fara') {
        add('spateAtipic', { mat: tp >= 8 ? 'PAL' : 'PFL' }, 1, g.W, g.H, '-', '-', '-', '-', '-',
            ['dupaContur'],
            [{ x: 0, y: 0, z: -tp, sx: g.W, sy: g.H, sz: tp,
               polyFata: g.puncte, f: F({ pz: 'p', nz: 'p' }), ex: [0, 0, -1], grp: 'spate' }]);
      }

      if (nUsi > 0) {
        var rmA = rm;
        add('frontAtipic', null, 1, r1(g.W - 2 * rmA), r1(g.H - 2 * rmA), 'g', 'g', 'g', 'g', 'LV',
            ['dupaConturCuRost', { rost: fmt(rmA) }],
            [{ x: 0, y: 0, z: Da, sx: g.W, sy: g.H, sz: t,
               polyFata: g.puncte, f: FDa, ex: [0, 0, 1.6], grp: 'fronturi' }]);
        usiA.push({ L: r1(g.H - 2 * rmA), H: r1(g.H - 2 * rmA) });
      }

      if (nPol > 0) {
        avert('politeAtipic');
      }

      return {
        P: P, warn: warn, avertismente: avertismente, usi: usiA,
        Wint: r1(g.W - 2 * t), Hint: r1(g.H - 2 * t), Dint: r1(Da - tp),
        W: g.W, H: g.H, D: Da,
        contur: g
      };
    }

    /* ============ corpuri de colț (în L sau cu front diagonal) ============
       A = latura pe peretele 1 (W), B = latura pe peretele 2 (W2),
       D = adâncimea brațelor. Blatul, fundul și polițele nu sunt dreptunghiuri:
       se debitează dreptunghiul de gabarit și apoi se decupează colțul. */
    if (esteColt(c.tip)) {
      var dg = c.tip === 'colt-diagonal';
      var A = W, B = +c.W2;
      var bA = r1(A - t), bB = r1(B - t);        /* panoul orizontal, între laterale */
      var brA = r1(bA - D), brB = r1(bB - D);    /* decupajul din colțul opus */
      var diagL = r1(Math.sqrt(brA * brA + brB * brB));
      var aplK = c.montaj === 'aplicat';
      var uHK = r1(aplK ? H - 2 * rm : Hint - 2 * rinc);
      var FDK = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
      var jpK = +c.jp;
      var usiK = [];

      if (brA <= 0 || brB <= 0) {
        avert('adancimePreaMare', { d: fmt(D), a: fmt(A), b: fmt(B) });
      }
      if (nSer > 0) {
        avert('sertareColt');
      }

      /* laterale: câte una la capătul fiecărui braț */
      add('laterala', null, 2, H, D, 'g', '-', 's', 's', 'LV',
          ['unaPeBrat'], [
        bx(A - t, 0, 0, t, H, D, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [1, 0, 0], 'corp'),
        bx(0, 0, B - t, D, H, t, F({ pz: 'f', nz: 'f', px: 'g', py: 's', ny: 's' }), [0, 0, 1], 'corp')
      ]);

      /* blat și fund: panou în L sau pentagon */
      var polyOr = dg
        ? [[0, 0], [bA, 0], [bA, D], [D, bB], [0, bB]]
        : [[0, 0], [bA, 0], [bA, D], [D, D], [D, bB], [0, bB]];
      var notaPanou = dg
        ? ['panouPentagon', { a: fmt(bA), b: fmt(bB), ca: fmt(brA), cb: fmt(brB), diag: fmt(diagL) }]
        : ['panouL', { a: fmt(bA), b: fmt(bB), ca: fmt(brA), cb: fmt(brB) }];

      add('blat', null, 1, bA, bB, '-', '-', '-', '-', 'L', notaPanou,
        [bp(0, H - t, 0, polyOr, t, [0, 1, 0], 'corp')]);
      add('fund', null, 1, bA, bB, '-', '-', '-', '-', 'L', notaPanou,
        [bp(0, 0, 0, polyOr, t, [0, -1, 0], 'corp')]);

      /* spate: câte un panou pe fiecare perete */
      var matSp = { mat: tp >= 8 ? 'PAL' : 'PFL' };
      var FSK = F({ pz: 'p', nz: 'p', px: 'p', nx: 'p', py: 'p', ny: 'p' });
      add('spatePerete1', matSp, 1, H - 3, A - 3, '-', '-', '-', '-', '-', ['capsatSprePerete'],
        [bx(1.5, 1.5, -tp, A - 3, H - 3, tp, FSK, [0, 0, -1], 'spate')]);
      add('spatePerete2', matSp, 1, H - 3, B - tp - 3, '-', '-', '-', '-', '-', ['capsatCealalta'],
        [bx(-tp, 1.5, 1.5, tp, H - 3, B - tp - 3, FSK, [-1, 0, 0], 'spate')]);

      /* fronturi (nUsi = 0 înseamnă colț deschis) */
      if (nUsi > 0 && dg) {
        var uLK = r1(diagL - 2 * rm);
        var mx = (bA + D) / 2, mz = (D + bB) / 2;     /* mijlocul diagonalei */
        add('usaDiagonala', null, 1, uHK, uLK, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleDiagonala', { n: balamale(uHK), cot: c.balama }],
            [{ x: mx - uLK / 2, y: aplK ? rm : t + rinc, z: mz - t / 2,
               sx: uLK, sy: uHK, sz: t, f: FDK, ex: [1.1, 0, 1.1], grp: 'fronturi',
               ry: Math.atan2(-(bB - D), D - bA), rotCenter: true }]);
        usiK.push({ L: uLK, H: uHK });
        if (uLK > 600) avert('usaDiagonalaLata');
      } else if (nUsi > 0) {
        var uL1 = r1(brA - rm - ri / 2), uL2 = r1(brB - rm - ri / 2);
        var yF = aplK ? rm : t + rinc;
        add('usaBrat1', null, 1, uHK, uL1, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleBrat1', { n: balamale(uHK), cot: c.balama }],
            [bx(D + rm, yF, D, uL1, uHK, t, FDK, [0, 0, 1.6], 'fronturi')]);
        add('usaBrat2', null, 1, uHK, uL2, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleCot', { n: balamale(uHK), cot: c.balama }],
            [bx(D, yF, D + rm, t, uHK, uL2, FDK, [1.6, 0, 0], 'fronturi')]);
        usiK.push({ L: uL1, H: uHK });
        usiK.push({ L: uL2, H: uHK });
      }

      /* polițe: aceeași formă ca blatul, retrase față de fronturi */
      if (nPol > 0) {
        var pA = r1(bA - jpK), pB = r1(bB - jpK);
        var pD = r1(D - (+c.rp));
        var pbrA = r1(pA - pD), pbrB = r1(pB - pD);
        var polyPol = dg
          ? [[0, 0], [pA, 0], [pA, pD], [pD, pB], [0, pB]]
          : [[0, 0], [pA, 0], [pA, pD], [pD, pD], [pD, pB], [0, pB]];
        var boxesPol = [];
        for (var ip = 1; ip <= nPol; ip++) {
          var ycK = t + (Hint) * ip / (nPol + 1);
          boxesPol.push(bp(jpK / 2, ycK - t / 2, jpK / 2, polyPol, t, [0, 0, 0.6], 'polite'));
        }
        add('polita', null, nPol, pA, pB, '-', '-', '-', '-', 'L',
            [dg ? 'politaPentagon' : 'politaL',
             { a: fmt(pA), b: fmt(pB), ca: fmt(pbrA), cb: fmt(pbrB) }],
            boxesPol);
        if (pA > 800 || pB > 800) avert('politaColtLata');
      }

      return { P: P, warn: warn, avertismente: avertismente, usi: usiK, Wint: bA, Hint: Hint, Dint: D,
               W: A, H: H, D: B, colt: { A: A, B: B, brA: brA, brB: brB, diag: diagL, dg: dg } };
    }

    /* ---- corp ---- */
    if (c.constr === 'intre') {
      add('laterala', null, 2, H, Dp, 'g', '-', 's', 's', 'LV', null, [
        bx(0, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [-1, 0, 0], 'corp'),
        bx(W - t, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [1, 0, 0], 'corp')]);
      add('blat', null, 1, Wint, Dp, 'g', '-', '-', '-', 'L', null,
        [bx(t, H - t, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, 1, 0], 'corp')]);
      add('fund', null, 1, Wint, Dp, 'g', '-', '-', '-', 'L', null,
        [bx(t, 0, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, -1, 0], 'corp')]);
    } else {
      add('blat', null, 1, W, Dp, 'g', '-', 's', 's', 'L', null,
        [bx(0, H - t, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, 1, 0], 'corp')]);
      add('fund', null, 1, W, Dp, 'g', '-', 's', 's', 'L', null,
        [bx(0, 0, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, -1, 0], 'corp')]);
      add('laterala', null, 2, Hint, Dp, 'g', '-', '-', '-', 'LV', null, [
        bx(0, t, zb, t, Hint, Dp, F({ px: 'f', nx: 'f', pz: 'g' }), [-1, 0, 0], 'corp'),
        bx(W - t, t, zb, t, Hint, Dp, F({ px: 'f', nx: 'f', pz: 'g' }), [1, 0, 0], 'corp')]);
    }

    /* ---- spate ---- */
    var fs = c.spate === 'pal' ? 'f' : 'p';
    var FS = F({
      px: fs === 'p' ? 'p' : '-', nx: fs === 'p' ? 'p' : '-',
      py: fs === 'p' ? 'p' : '-', ny: fs === 'p' ? 'p' : '-', pz: fs, nz: fs
    });
    if (aplicat) {
      add('spateAplicat', { mat: tp >= 8 ? 'PAL' : 'PFL' }, 1, H - 3, W - 3, '-', '-', '-', '-', '-',
        ['capsatPeSpate'], [bx(1.5, 1.5, 0, W - 3, H - 3, tp, FS, [0, 0, -1], 'spate')]);
    } else {
      add('spateNut', null, 1, Hint + 2 * (NUT_AD - 1), Wint + 2 * (NUT_AD - 1), '-', '-', '-', '-', '-',
        ['nutSpate', { off: NUT_OFF, ad: NUT_AD }],
        [bx(t - (NUT_AD - 1), t - (NUT_AD - 1), NUT_OFF,
            Wint + 2 * (NUT_AD - 1), Hint + 2 * (NUT_AD - 1), tp, FS, [0, 0, -1], 'spate')]);
    }

    /* ---- fronturi: pozitii ---- */
    var apl = c.montaj === 'aplicat';
    var xoff = apl ? rm : t + rinc;
    var yTop = apl ? H - rm : H - t - rinc;
    var yBot = apl ? rm : t + rinc;
    var zF = apl ? D : D - t;
    /* la corpul de colț orb, o parte din front rămâne acoperită de corpul vecin */
    var orb = c.tip === 'colt-orb' ? Math.max(0, +c.orb) : 0;
    var fL = (apl ? W - 2 * rm : Wint - 2 * rinc) - orb;
    if (orb > 0 && fL <= 0) {
      avert('zonaOarbaPreaMare', { orb: fmt(orb) });
    }
    var FD = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
    var usedTop = nSer > 0 ? nSer * (+c.hFront) + nSer * ri : 0;

    /* ---- usi ---- */
    var usi = [];
    if (nUsi > 0) {
      var uH = (apl ? H - 2 * rm : Hint - 2 * rinc) - usedTop;
      var uL = (fL - (nUsi - 1) * ri) / nUsi;
      if (uH <= 0) {
        avert('fronturiSertarPreaInalte');
      } else {
        var boxesU = [];
        for (var i = 0; i < nUsi; i++) {
          boxesU.push(bx(xoff + i * (uL + ri), yBot, zF, uL, uH, t, FD, [0, 0, 1.6], 'fronturi'));
        }
        add('usa', null, nUsi, uH, uL, 'g', 'g', 'g', 'g', 'LV',
          orb > 0
            ? ['balamaleUsaOrb', { n: balamale(uH), cot: c.balama, orb: fmt(orb) }]
            : ['balamaleUsa', { n: balamale(uH), cot: c.balama }], boxesU);
        usi.push({ L: uL, H: uH });
        if (uL > 600) avert('usaLata');
        if (uH > 2000) avert('usaInalta');
        if (apl && c.balama !== '0' && nUsi === 1) avert('balamaCot0');
        if (!apl && c.balama !== '18') avert('balamaCot18');
      }
    }

    /* ---- sertare ---- */
    if (nSer > 0) {
      var jg = +c.jg, ts = +c.ts, hF = +c.hFront, hc = +c.hCutie;
      var lg = +c.lg;
      if (!lg) { lg = Math.floor((Dint - 10) / 50) * 50; }
      if (lg > Dint) avert('glisieraNuIncape', { lg: lg, dint: fmt(Dint) });
      if (hc > hF) avert('cutiePreaInalta');
      var cut = Wint - 2 * jg;
      var zf = zF - 2, dz = [0, 0, 1.1];
      var fr = [], lat = [], fsp = [], fnd = [];
      for (var k = 0; k < nSer; k++) {
        var yt = yTop - k * (hF + ri), yb0 = yt - hF;
        var yb = yb0 + Math.max(0, (hF - hc) / 2);
        fr.push(bx(xoff, yb0, zF, fL, hF, t, FD, [0, 0, 1.6], 'fronturi'));
        lat.push(bx(t + jg, yb, zf - lg, ts, hc, lg,
          F({ px: 'f', nx: 'f', py: 's', ny: 's', pz: 's', nz: 's' }), dz, 'sertare'));
        lat.push(bx(W - t - jg - ts, yb, zf - lg, ts, hc, lg,
          F({ px: 'f', nx: 'f', py: 's', ny: 's', pz: 's', nz: 's' }), dz, 'sertare'));
        fsp.push(bx(t + jg + ts, yb, zf - ts, cut - 2 * ts, hc, ts,
          F({ pz: 'f', nz: 'f', py: 's', ny: 's' }), dz, 'sertare'));
        fsp.push(bx(t + jg + ts, yb, zf - lg, cut - 2 * ts, hc, ts,
          F({ pz: 'f', nz: 'f', py: 's', ny: 's' }), dz, 'sertare'));
        fnd.push(bx(t + jg, yb - PFL_SERTAR, zf - lg, cut, PFL_SERTAR, lg,
          F({ px: 'p', nx: 'p', py: 'p', ny: 'p', pz: 'p', nz: 'p' }), dz, 'sertare'));
      }
      add('frontSertar', null, nSer, hF, fL, 'g', 'g', 'g', 'g', 'LO',
        ['rostFronturi', { rost: ri }], fr);
      add('sertarLaterala', null, 2 * nSer, lg, hc, 's', 's', 's', 's', 'L',
        ['glisieraDe', { lg: lg }], lat);
      add('sertarFataSpate', null, 2 * nSer, cut - 2 * ts, hc, 's', 's', '-', '-', 'L', null, fsp);
      add('sertarFund', null, nSer, lg, cut, '-', '-', '-', '-', '-', ['subCutie'], fnd);
    }

    /* ---- montanți (despărțitori) ----

       Se prind de blat și de fund exact ca lateralele: aceleași dibluri în
       cant la capete și aceleași excentrice. Împart interiorul în nDsp + 1
       compartimente egale, iar polițele se fac pe compartiment. */
    var compartimente = nDsp + 1;
    var Wcomp = (Wint - nDsp * t) / compartimente;             /* lățimea unui compartiment */
    var xComp = function (i) { return t + i * (Wcomp + t); };  /* unde începe compartimentul i */

    if (nDsp > 0) {
      var boxesD = [];
      for (var d = 1; d <= nDsp; d++) {
        boxesD.push(bx(xComp(d) - t, t, zb, t, Hint, Dp,
          F({ px: 'f', nx: 'f', pz: 'g' }), [0, 0, 0], 'corp'));
      }
      /* muchia din față se cantuiește ca la laterale, restul stau ascunse */
      add('montant', null, nDsp, Hint, Dp, 'g', '-', '-', '-', 'LV', null, boxesD);

      if (Wcomp < 100) avert('compartimentIngust', { lat: fmt(Wcomp) });
      if (nUsi > 0 && nUsi % compartimente !== 0) {
        avert('usiPesteMontant', { usi: nUsi, comp: compartimente });
      }
      if (nSer > 0) avert('sertareCuMontant');
    }

    /* ---- polite ---- */
    if (nPol > 0) {
      var jp = +c.jp, pL = Wcomp - jp, pl = Dint - (+c.rp);
      var boxesP = [];
      for (var ic = 0; ic < compartimente; ic++) {
        for (var j = 1; j <= nPol; j++) {
          var yc = t + (Hint - usedTop) * j / (nPol + 1);
          boxesP.push(bx(xComp(ic) + jp / 2, yc - t / 2, zin, pL, t, pl,
            F({ py: 'f', ny: 'f', pz: 'g' }), [0, 0, 0.6], 'polite'));
        }
      }
      add('polita', null, nPol * compartimente, pL, pl, 'g', '-', '-', '-', 'L', null, boxesP);
      if (pL > 800) avert('politaLunga', { lung: fmt(pL) });
    }

    return { P: P, warn: warn, avertismente: avertismente, usi: usi, Wint: Wint, Hint: Hint, Dint: Dint, W: W, H: H, D: D };
  }

  /* ---- CSV (acelasi format ca in calculatorul original, in limba paginii) ---- */
  var COLOANE_CSV = ['corp', 'piesa', 'buc', 'finitL', 'finitl', 'cantL1', 'cantL2', 'cantl1', 'cantl2',
                     'taiereL', 'taierel', 'fibra', 'nota'];

  function csv(list, tr) {
    var t_ = traducator(tr);
    var head = COLOANE_CSV.map(function (k) { return t_('csv.' + k); });
    var ev = function (c, v) { return v === 'g' ? c.cg : v === 's' ? c.cs : 0; };
    var rows = [head.join(';')];
    list.forEach(function (c) {
      calc(c, t_).P.forEach(function (p) {
        rows.push([c.nume, p.nume, p.buc, p.L, p.l,
                   ev(c, p.c[0]), ev(c, p.c[1]), ev(c, p.c[2]), ev(c, p.c[3]),
                   p.TL, p.Tl, p.fibraText, p.nota || '']
          .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
      });
    });
    return rows.join('\n');
  }

  /* ---- validare (doar pe server, unde exista zod) ---- */
  var paramsSchema = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    try {
      var z = require('zod').z;
      var mm = function (min, max) { return z.coerce.number().finite().min(min).max(max); };
      var int = function (min, max) { return z.coerce.number().int().min(min).max(max); };
      paramsSchema = z.object({
        nume: z.string().trim().min(1).max(80).catch('Corp'),
        W: mm(100, 3000), H: mm(100, 3000), D: mm(100, 3000),
        tip: z.enum(TIPURI).catch('drept'),
        W2: mm(100, 3000).catch(900),
        orb: mm(0, 2000).catch(0),
        /* Fără `.catch` aici, înadins. Un `.catch([])` pe vector înseamnă că o
           singură latură greșită — sau un câmp lăsat gol în formular — golește
           tot conturul, salvarea reușește, iar corpul atipic devine în tăcere
           un dreptunghi W×H. Se pierde și avertismentul „conturul nu se
           închide", fiindcă nu mai e nimic de închis, deci nimic nu-l prinde.
           Un corp drept nu trece pe aici cu conturul lipsă: defaults() dă
           `contur: []`, iar vectorul gol e valid. */
        contur: z.array(z.object({
          lung: z.coerce.number().min(10).max(4000),
          unghi: z.coerce.number().min(1).max(359)
        })).max(32),
        constr: z.enum(['intre', 'peste']),
        t: mm(6, 50), cg: mm(0, 5), cs: mm(0, 5),
        spate: z.enum(['aplicat', 'nut', 'pal']),
        tp: mm(0, 50),
        nUsi: int(0, 6),
        montaj: z.enum(['aplicat', 'incastrat']),
        balama: z.preprocess(function (v) { return String(v); }, z.enum(['0', '9', '18'])),
        rm: mm(0, 50), ri: mm(0, 50), rinc: mm(0, 50),
        nPol: int(0, 20), jp: mm(0, 50), rp: mm(0, 300),
        /* montanți (despărțitori) — 0 înseamnă corp fără compartimentare */
        nDsp: int(0, 6).catch(0),
        nSer: int(0, 12), hFront: mm(20, 1200), hCutie: mm(20, 1200),
        jg: mm(0, 50), ts: mm(10, 30),
        /* reglajul de debitare al atelierului; implicit cel măsurat pe
           lucrările reale — vezi reducereCant() */
        pragCant: mm(0, 10).catch(PRAG_CANT),
        rezervaCant: mm(0, 10).catch(REZERVA_CANT),
        lg: z.union([z.literal(''), z.coerce.number().min(0).max(1200)]).catch('')
      }).strict();
    } catch (e) {
      /* zod nu e instalat inca (ex. inainte de npm install) */
    }
  }

  return {
    calc: calc,
    rolPiesa: rolPiesa,
    directie: directie,
    numeDirectie: numeDirectie,
    traducator: traducator,
    defaults: defaults,
    balamale: balamale,
    csv: csv,
    conturGeometrie: conturGeometrie,
    conturImplicit: conturImplicit,
    reducereCant: reducereCant,
    TIPURI: TIPURI,
    paramsSchema: paramsSchema,
    NUT_OFF: NUT_OFF,
    NUT_AD: NUT_AD,
    PFL_SERTAR: PFL_SERTAR
  };
});
