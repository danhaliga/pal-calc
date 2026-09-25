/* ============================================================
   Optimizator de croire PAL - taieri de tip ghilotina (beam saw)
   Fiecare taiere merge dintr-o margine in cealalta a zonei,
   exact cum lucreaza un fierastrau cu panza / masina de debitat.
   Expune: window.Croire.optimize(input)
   ============================================================ */
(function (global) {
  'use strict';

  var EPS = 0.01;

  var ORDERS = ['areaDesc', 'maxDesc', 'lenDesc', 'widDesc'];
  var SPLITS = ['wide', 'tall', 'v', 'h'];
  var FITS   = ['area', 'short', 'bl'];

  /* ---------- structura de noduri (arborele de taieri) ---------- */

  function node(x, y, w, h) {
    return { x: x, y: y, w: w, h: h, type: 'free', dir: null, a: null, b: null };
  }

  function walk(n, fn) {
    if (!n) return;
    fn(n);
    if (n.type === 'split') { walk(n.a, fn); walk(n.b, fn); }
  }

  function freeLeaves(root) {
    var out = [];
    walk(root, function (n) { if (n.type === 'free') out.push(n); });
    return out;
  }

  function usable(n) { return (n && n.w > EPS && n.h > EPS) ? n : null; }

  /* Aseaza o piesa pw x ph in colul stanga-sus al zonei libere.
     Genereaza maxim doua taieri, ambele de tip ghilotina. */
  function placePiece(leaf, pw, ph, kerf, rule, cuts) {
    var restW = leaf.w - pw;
    var restH = leaf.h - ph;
    var vertFirst;
    if (rule === 'v') vertFirst = true;
    else if (rule === 'h') vertFirst = false;
    else if (rule === 'wide') vertFirst = restW >= restH;
    else vertFirst = restW < restH;

    var piece = node(leaf.x, leaf.y, pw, ph);
    piece.type = 'piece';

    if (vertFirst) {
      /* taiere verticala pe toata inaltimea zonei, apoi retezare orizontala */
      if (restW > EPS) cuts.push({ dir: 'v', x: leaf.x + pw, y: leaf.y, len: leaf.h, stage: 1 });
      if (restH > EPS) cuts.push({ dir: 'h', x: leaf.x, y: leaf.y + ph, len: pw, stage: 2 });
      var col = node(leaf.x, leaf.y, pw, leaf.h);
      col.type = 'split'; col.dir = 'h';
      col.a = piece;
      col.b = usable(node(leaf.x, leaf.y + ph + kerf, pw, restH - kerf));
      leaf.type = 'split'; leaf.dir = 'v';
      leaf.a = col;
      leaf.b = usable(node(leaf.x + pw + kerf, leaf.y, restW - kerf, leaf.h));
    } else {
      /* taiere orizontala pe toata latimea zonei, apoi retezare verticala */
      if (restH > EPS) cuts.push({ dir: 'h', x: leaf.x, y: leaf.y + ph, len: leaf.w, stage: 1 });
      if (restW > EPS) cuts.push({ dir: 'v', x: leaf.x + pw, y: leaf.y, len: ph, stage: 2 });
      var band = node(leaf.x, leaf.y, leaf.w, ph);
      band.type = 'split'; band.dir = 'v';
      band.a = piece;
      band.b = usable(node(leaf.x + pw + kerf, leaf.y, restW - kerf, ph));
      leaf.type = 'split'; leaf.dir = 'h';
      leaf.a = band;
      leaf.b = usable(node(leaf.x, leaf.y + ph + kerf, leaf.w, restH - kerf));
    }
    return piece;
  }

  /* Alege zona libera in care intra piesa, dupa regula de potrivire. */
  function pickLeaf(leaves, pw, ph, fitRule) {
    var best = null, bestScore = Infinity, bestTie = Infinity;
    for (var i = 0; i < leaves.length; i++) {
      var L = leaves[i];
      if (pw > L.w + EPS || ph > L.h + EPS) continue;
      var dw = L.w - pw, dh = L.h - ph;
      var pos = L.y * 100000 + L.x;
      var score, tie;
      if (fitRule === 'area')       { score = L.w * L.h - pw * ph; tie = pos; }
      else if (fitRule === 'short') { score = Math.min(dw, dh);    tie = pos; }
      else if (fitRule === 'long')  { score = Math.max(dw, dh);    tie = pos; }
      else                          { score = pos;                 tie = L.w * L.h; }
      if (score < bestScore - EPS || (Math.abs(score - bestScore) <= EPS && tie < bestTie)) {
        best = L; bestScore = score; bestTie = tie;
      }
    }
    return best ? { leaf: best, score: bestScore } : null;
  }

  /* ---------- umplerea unei singure placi ---------- */

  function packBin(sheet, pieces, opt, heur) {
    var trim = opt.trim || 0;
    var uw = sheet.w - 2 * trim;
    var uh = sheet.h - 2 * trim;
    var root = node(trim, trim, uw, uh);
    var cuts = [], placements = [], usedArea = 0;

    if (uw <= EPS || uh <= EPS) {
      return { sheet: sheet, root: root, cuts: cuts, placements: placements,
               usedArea: 0, usableArea: 0 };
    }

    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var leaves = freeLeaves(root);
      var variants = [{ w: p.cw, h: p.ch, rot: false }];
      if (p.rotatable && Math.abs(p.cw - p.ch) > EPS) {
        variants.push({ w: p.ch, h: p.cw, rot: true });
      }

      var chosen = null;
      for (var v = 0; v < variants.length; v++) {
        var hit = pickLeaf(leaves, variants[v].w, variants[v].h, heur.fit);
        if (!hit) continue;
        if (!chosen || hit.score < chosen.score - EPS) {
          chosen = { leaf: hit.leaf, score: hit.score,
                     w: variants[v].w, h: variants[v].h, rot: variants[v].rot };
        }
      }
      if (!chosen) continue;

      var pn = placePiece(chosen.leaf, chosen.w, chosen.h, opt.kerf, heur.split, cuts);
      placements.push({
        idx: i, piece: p, x: pn.x, y: pn.y, w: chosen.w, h: chosen.h, rotated: chosen.rot
      });
      usedArea += chosen.w * chosen.h;
    }

    return { sheet: sheet, root: root, cuts: cuts, placements: placements,
             usedArea: usedArea, usableArea: uw * uh };
  }

  /* ---------- sortarea pieselor ---------- */

  /* generator pseudo-aleator cu samanta: acelasi proiect da acelasi plan */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sortKey(p, order) {
    switch (order) {
      case 'maxDesc': return Math.max(p.cw, p.ch) * 1e6 + p.cw * p.ch;
      case 'lenDesc': return p.cw * 1e6 + p.ch;
      case 'widDesc': return p.ch * 1e6 + p.cw;
      default:        return p.cw * p.ch * 1e3 + Math.max(p.cw, p.ch);
    }
  }

  /* jitter > 0 perturba ordinea, pentru restarturi randomizate */
  function sortPieces(pieces, order, jitter, rand) {
    var a = pieces.map(function (p) {
      var k = sortKey(p, order);
      if (jitter > 0 && rand) k *= 1 + (rand() - 0.5) * jitter;
      return { p: p, k: k };
    });
    a.sort(function (x, y) { return y.k - x.k; });
    return a.map(function (x) { return x.p; });
  }

  /* ---------- o rulare completa pentru un material ---------- */

  function runHeuristic(pieces0, sheetTypes, opt, heur) {
    var remaining = sortPieces(pieces0, heur.order, heur.jitter, heur.rand);
    var stock = sheetTypes.map(function (s) { return (s.qty && s.qty > 0) ? s.qty : Infinity; });
    var bins = [], guard = 0;

    while (remaining.length && guard++ < 3000) {
      var best = null, bestIdx = -1, bestFill = -1;
      for (var t = 0; t < sheetTypes.length; t++) {
        if (stock[t] <= 0) continue;
        var trial = packBin(sheetTypes[t], remaining, opt, heur);
        if (!trial.placements.length) continue;
        var fill = trial.usableArea > 0 ? trial.usedArea / trial.usableArea : 0;
        var take = !best
          || fill > bestFill + 0.02
          || (Math.abs(fill - bestFill) <= 0.02 && trial.usableArea > best.usableArea);
        if (take) { best = trial; bestIdx = t; bestFill = fill; }
      }
      if (!best) break;

      stock[bestIdx]--;
      bins.push(best);
      var taken = {};
      best.placements.forEach(function (pl) { taken[pl.idx] = true; });
      remaining = remaining.filter(function (_, i) { return !taken[i]; });
    }

    return { bins: bins, unplaced: remaining, heur: heur };
  }

  function scoreOf(res) {
    if (res._score) return res._score;
    var area = 0, cuts = 0, maxFree = 0;
    res.bins.forEach(function (b) {
      area += b.sheet.w * b.sheet.h;
      cuts += b.cuts.length;
      freeLeaves(b.root).forEach(function (n) { maxFree = Math.max(maxFree, n.w * n.h); });
    });
    res._score = { unplaced: res.unplaced.length, area: area, sheets: res.bins.length,
                   cuts: cuts, maxFree: maxFree };
    return res._score;
  }

  /* la acelasi consum de placi, prefera restul cel mai mare (recuperabil) */
  function isBetter(a, b) {
    if (!b) return true;
    var x = scoreOf(a), y = scoreOf(b);
    if (x.unplaced !== y.unplaced) return x.unplaced < y.unplaced;
    if (Math.abs(x.area - y.area) > 1) return x.area < y.area;
    if (x.sheets !== y.sheets) return x.sheets < y.sheets;
    if (Math.abs(x.maxFree - y.maxFree) > 1000) return x.maxFree > y.maxFree;
    return x.cuts < y.cuts;
  }

  /* ---------- API ---------- */

  function optimize(input) {
    var settings = input.settings || {};
    var opt = {
      kerf: settings.kerf != null ? settings.kerf : 4,
      trim: settings.trim || 0
    };
    var minOff = settings.minOffcut || 0;

    var groups = {};
    input.pieces.forEach(function (p) {
      (groups[p.materialId] = groups[p.materialId] || []).push(p);
    });

    var heavy = input.pieces.length > 250;
    var orders = heavy ? ORDERS.slice(0, 2) : ORDERS;
    var splits = heavy ? SPLITS.slice(0, 2) : SPLITS;
    var fits   = heavy ? FITS.slice(0, 2)   : FITS;

    var perMaterial = [];

    input.materials.forEach(function (mat) {
      var pieces = groups[mat.id];
      if (!pieces || !pieces.length) return;

      var sheetTypes = (mat.sheets || []).filter(function (s) { return s.w > 0 && s.h > 0; });
      if (!sheetTypes.length) {
        perMaterial.push({ material: mat, bins: [], unplaced: pieces.slice(),
                           reason: 'Materialul nu are nicio dimensiune de placa definita.' });
        return;
      }

      var best = null;
      orders.forEach(function (order) {
        splits.forEach(function (split) {
          fits.forEach(function (fit) {
            var res = runHeuristic(pieces, sheetTypes, opt, { order: order, split: split, fit: fit });
            if (isBetter(res, best)) best = res;
          });
        });
      });

      /* restarturi randomizate: aceeasi lista da mereu acelasi plan (samanta fixa) */
      var budget = settings.effortMs != null ? settings.effortMs : 600;
      if (budget > 0) {
        var seed = pieces.length * 7919;
        pieces.forEach(function (p) { seed = (seed + p.cw * 31 + p.ch * 17) | 0; });
        var rand = rng(seed);
        var t0 = Date.now(), tries = 0;
        while (Date.now() - t0 < budget && tries < 4000) {
          tries++;
          var res2 = runHeuristic(pieces, sheetTypes, opt, {
            order: ORDERS[(rand() * ORDERS.length) | 0],
            split: SPLITS[(rand() * SPLITS.length) | 0],
            fit: FITS[(rand() * FITS.length) | 0],
            jitter: 0.04 + rand() * 0.45,
            rand: rand
          });
          if (isBetter(res2, best)) best = res2;
        }
        best.tries = tries;
      }

      best.bins.forEach(function (bin, i) {
        var area = bin.sheet.w * bin.sheet.h;
        bin.index = i + 1;
        bin.offcuts = minOff > 0
          ? freeLeaves(bin.root)
              .filter(function (n) { return n.w >= minOff && n.h >= minOff; })
              .sort(function (a, b) { return (b.w * b.h) - (a.w * a.h); })
          : [];
        bin.cutLength = bin.cuts.reduce(function (s, c) { return s + c.len; }, 0);
        bin.fillPct = area > 0 ? 100 * bin.usedArea / area : 0;
        bin.wastePct = 100 - bin.fillPct;
      });

      perMaterial.push({
        material: mat,
        bins: best.bins,
        unplaced: best.unplaced,
        heur: best.heur
      });
    });

    var knownIds = {};
    input.materials.forEach(function (m) { knownIds[m.id] = true; });
    var orphans = input.pieces.filter(function (p) { return !knownIds[p.materialId]; });

    var totals = { sheets: 0, sheetArea: 0, pieceArea: 0, cutLength: 0,
                   pieces: 0, unplaced: orphans.length };
    perMaterial.forEach(function (g) {
      totals.sheets += g.bins.length;
      totals.unplaced += g.unplaced.length;
      g.bins.forEach(function (b) {
        totals.sheetArea += b.sheet.w * b.sheet.h;
        totals.pieceArea += b.usedArea;
        totals.cutLength += b.cutLength;
        totals.pieces += b.placements.length;
      });
    });
    totals.wastePct = totals.sheetArea > 0 ? 100 * (1 - totals.pieceArea / totals.sheetArea) : 0;

    return { perMaterial: perMaterial, orphans: orphans, totals: totals, settings: settings };
  }

  global.Croire = { optimize: optimize, freeLeaves: freeLeaves };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Croire;
})(typeof window !== 'undefined' ? window : globalThis);
