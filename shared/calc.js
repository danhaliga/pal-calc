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
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NUT_OFF = 10;      /* distanta nutului fata de spatele corpului */
  var NUT_AD = 8;        /* adancimea nutului */
  var PFL_SERTAR = 3;    /* grosimea fundului de sertar */

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var fmt = function (v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); };

  function defaults() {
    return {
      nume: 'Corp bucătărie jos', W: 800, H: 720, D: 560, constr: 'intre',
      t: 18, cg: 2, cs: 0.4, spate: 'aplicat', tp: 3,
      nUsi: 2, montaj: 'aplicat', balama: '0', rm: 1.5, ri: 3, rinc: 2,
      nPol: 1, jp: 1, rp: 20,
      nSer: 0, hFront: 150, hCutie: 100, jg: 12.5, ts: 16, lg: ''
    };
  }

  function balamale(h) { return h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5; }

  function calc(c) {
    var W = +c.W, H = +c.H, D = +c.D, t = +c.t, cg = +c.cg, cs = +c.cs, tp = +c.tp;
    var rm = +c.rm, ri = +c.ri, rinc = +c.rinc, nUsi = +c.nUsi, nPol = +c.nPol, nSer = +c.nSer;
    var P = [], warn = [];
    var aplicat = c.spate === 'aplicat';
    var zb = aplicat ? tp : 0;              /* unde incep piesele corpului pe adancime */
    var Dp = D - zb;                        /* adancimea pieselor corpului */
    var zin = aplicat ? tp : NUT_OFF + tp;  /* fata interioara a spatelui */
    var Dint = D - zin;                     /* adancime interioara utila */
    var Wint = W - 2 * t, Hint = H - 2 * t;
    var ev = function (v) { return v === 'g' ? cg : v === 's' ? cs : 0; };

    var add = function (nume, buc, L, l, cL1, cL2, cl1, cl2, fibra, nota, boxes) {
      P.push({
        nume: nume, buc: buc, L: r1(L), l: r1(l), c: [cL1, cL2, cl1, cl2],
        TL: r1(L - ev(cL1) - ev(cL2)), Tl: r1(l - ev(cl1) - ev(cl2)),
        fibra: fibra, nota: nota, boxes: boxes || []
      });
    };
    var bx = function (x, y, z, sx, sy, sz, f, ex, grp) {
      return { x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, f: f, ex: ex, grp: grp };
    };
    var F = function (o) {
      return Object.assign({ px: '-', nx: '-', py: '-', ny: '-', pz: '-', nz: '-' }, o);
    };

    /* ---- corp ---- */
    if (c.constr === 'intre') {
      add('Laterală', 2, H, Dp, 'g', '-', 's', 's', 'L (vertical)', '', [
        bx(0, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [-1, 0, 0], 'corp'),
        bx(W - t, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [1, 0, 0], 'corp')]);
      add('Blat', 1, Wint, Dp, 'g', '-', '-', '-', 'L', '',
        [bx(t, H - t, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, 1, 0], 'corp')]);
      add('Fund', 1, Wint, Dp, 'g', '-', '-', '-', 'L', '',
        [bx(t, 0, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, -1, 0], 'corp')]);
    } else {
      add('Blat', 1, W, Dp, 'g', '-', 's', 's', 'L', '',
        [bx(0, H - t, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, 1, 0], 'corp')]);
      add('Fund', 1, W, Dp, 'g', '-', 's', 's', 'L', '',
        [bx(0, 0, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, -1, 0], 'corp')]);
      add('Laterală', 2, Hint, Dp, 'g', '-', '-', '-', 'L (vertical)', '', [
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
      add('Spate ' + (tp >= 8 ? 'PAL' : 'PFL') + ' aplicat', 1, H - 3, W - 3, '-', '-', '-', '-', '–',
        'capsat pe spate', [bx(1.5, 1.5, 0, W - 3, H - 3, tp, FS, [0, 0, -1], 'spate')]);
    } else {
      add('Spate în nut', 1, Hint + 2 * (NUT_AD - 1), Wint + 2 * (NUT_AD - 1), '-', '-', '-', '-', '–',
        'nut la ' + NUT_OFF + ' mm de spate, adâncime ' + NUT_AD + ' mm',
        [bx(t - (NUT_AD - 1), t - (NUT_AD - 1), NUT_OFF,
            Wint + 2 * (NUT_AD - 1), Hint + 2 * (NUT_AD - 1), tp, FS, [0, 0, -1], 'spate')]);
    }

    /* ---- fronturi: pozitii ---- */
    var apl = c.montaj === 'aplicat';
    var xoff = apl ? rm : t + rinc;
    var yTop = apl ? H - rm : H - t - rinc;
    var yBot = apl ? rm : t + rinc;
    var zF = apl ? D : D - t;
    var fL = apl ? W - 2 * rm : Wint - 2 * rinc;
    var FD = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
    var usedTop = nSer > 0 ? nSer * (+c.hFront) + nSer * ri : 0;

    /* ---- usi ---- */
    var usi = [];
    if (nUsi > 0) {
      var uH = (apl ? H - 2 * rm : Hint - 2 * rinc) - usedTop;
      var uL = (fL - (nUsi - 1) * ri) / nUsi;
      if (uH <= 0) {
        warn.push('Fronturile de sertar depășesc înălțimea corpului.');
      } else {
        var boxesU = [];
        for (var i = 0; i < nUsi; i++) {
          boxesU.push(bx(xoff + i * (uL + ri), yBot, zF, uL, uH, t, FD, [0, 0, 1.6], 'fronturi'));
        }
        add('Ușă', nUsi, uH, uL, 'g', 'g', 'g', 'g', 'L (vertical)',
          balamale(uH) + ' balamale/ușă, cot ' + c.balama, boxesU);
        usi.push({ L: uL, H: uH });
        if (uL > 600) warn.push('Ușă mai lată de 600 mm: risc de deformare și solicitare mare pe balamale.');
        if (uH > 2000) warn.push('Ușă peste 2000 mm: folosește 5 balamale sau împarte frontul.');
        if (apl && c.balama !== '0' && nUsi === 1) warn.push('Ușă aplicată pe un singur corp: de regulă balama cot 0.');
        if (!apl && c.balama !== '18') warn.push('Ușă încastrată: de regulă balama cot 18.');
      }
    }

    /* ---- sertare ---- */
    if (nSer > 0) {
      var jg = +c.jg, ts = +c.ts, hF = +c.hFront, hc = +c.hCutie;
      var lg = +c.lg;
      if (!lg) { lg = Math.floor((Dint - 10) / 50) * 50; }
      if (lg > Dint) warn.push('Glisiera de ' + lg + ' mm nu încape în adâncimea interioară de ' + fmt(Dint) + ' mm.');
      if (hc > hF) warn.push('Cutia sertarului este mai înaltă decât frontul.');
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
      add('Front sertar', nSer, hF, fL, 'g', 'g', 'g', 'g', 'L (orizontal)',
        'rost ' + ri + ' mm între fronturi', fr);
      add('Sertar – laterală cutie', 2 * nSer, lg, hc, 's', 's', 's', 's', 'L',
        'glisieră ' + lg + ' mm', lat);
      add('Sertar – față/spate cutie', 2 * nSer, cut - 2 * ts, hc, 's', 's', '-', '-', 'L', '', fsp);
      add('Sertar – fund PFL', nSer, lg, cut, '-', '-', '-', '-', '–', 'aplicat sub cutie', fnd);
    }

    /* ---- polite ---- */
    if (nPol > 0) {
      var jp = +c.jp, pL = Wint - jp, pl = Dint - (+c.rp);
      var boxesP = [];
      for (var j = 1; j <= nPol; j++) {
        var yc = t + (Hint - usedTop) * j / (nPol + 1);
        boxesP.push(bx(t + jp / 2, yc - t / 2, zin, pL, t, pl,
          F({ py: 'f', ny: 'f', pz: 'g' }), [0, 0, 0.6], 'polite'));
      }
      add('Poliță', nPol, pL, pl, 'g', '-', '-', '-', 'L', '', boxesP);
      if (pL > 800) {
        warn.push('Poliță de ' + fmt(pL) + ' mm: peste 800 mm PAL-ul de 18 se îndoaie; ' +
                  'folosește PAL 25 sau un montant central.');
      }
    }

    return { P: P, warn: warn, usi: usi, Wint: Wint, Hint: Hint, Dint: Dint, W: W, H: H, D: D };
  }

  /* ---- CSV (acelasi format ca in calculatorul original) ---- */
  function csv(list) {
    var head = ['Corp', 'Piesa', 'Buc', 'Finit L', 'Finit l', 'Cant L1', 'Cant L2', 'Cant l1', 'Cant l2',
                'Taiere L', 'Taiere l', 'Fibra', 'Nota'];
    var ev = function (c, v) { return v === 'g' ? c.cg : v === 's' ? c.cs : 0; };
    var rows = [head.join(';')];
    list.forEach(function (c) {
      calc(c).P.forEach(function (p) {
        rows.push([c.nume, p.nume, p.buc, p.L, p.l,
                   ev(c, p.c[0]), ev(c, p.c[1]), ev(c, p.c[2]), ev(c, p.c[3]),
                   p.TL, p.Tl, p.fibra, p.nota || '']
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
        constr: z.enum(['intre', 'peste']),
        t: mm(6, 50), cg: mm(0, 5), cs: mm(0, 5),
        spate: z.enum(['aplicat', 'nut', 'pal']),
        tp: mm(0, 50),
        nUsi: int(0, 6),
        montaj: z.enum(['aplicat', 'incastrat']),
        balama: z.preprocess(function (v) { return String(v); }, z.enum(['0', '9', '18'])),
        rm: mm(0, 50), ri: mm(0, 50), rinc: mm(0, 50),
        nPol: int(0, 20), jp: mm(0, 50), rp: mm(0, 300),
        nSer: int(0, 12), hFront: mm(20, 1200), hCutie: mm(20, 1200),
        jg: mm(0, 50), ts: mm(10, 30),
        lg: z.union([z.literal(''), z.coerce.number().min(0).max(1200)]).catch('')
      }).strict();
    } catch (e) {
      /* zod nu e instalat inca (ex. inainte de npm install) */
    }
  }

  return {
    calc: calc,
    defaults: defaults,
    balamale: balamale,
    csv: csv,
    paramsSchema: paramsSchema,
    NUT_OFF: NUT_OFF,
    NUT_AD: NUT_AD,
    PFL_SERTAR: PFL_SERTAR
  };
});
