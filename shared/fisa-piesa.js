/* ============================================================
   Fișa fiecărei piese a unui corp atipic (corpul de sub scară).

   Dan: „la corpul de sub scară să existe desenele cu fiecare piesă 3D
   pentru CNC, cu dimensiuni și unghiuri de tăiere clare — foarte
   important!!".

   Un corp atipic nu se taie ca unul drept. Laturile lui se îmbină în unghi:
   fiecare capăt se taie înclinat, la jumătate din unghiul colțului, iar
   unghiul ăla se dă la fierăstrău, nu se ghicește. Spatele, ușile și
   montanții au contur cu latura înclinată, deci merg la CNC cu conturul
   lor. Pentru fiecare piesă ies aici:

     - vederea piesei, cu TOATE cotele (fiecare latură) și unghiurile dintre
       laturi, plus dreptunghiul din care se taie;
     - la laturile îmbinate în unghi: secțiunea, cu cele două capete mărite,
       unghiul de tăiere față de fața piesei și înclinarea pânzei;
     - piesa în 3D, ca să se vadă ce iese din mână.

   Totul se face din calcul (`PalCalc.calc`): cotele de aici sunt aceleași
   cu cele din lista de debitare. Nu se socotește nimic a doua oară.

   Se încarcă și pe server (CommonJS), și în browser (window.PalFisa).
   ============================================================ */
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./calc') : root.PalCalc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalFisa = api;
})(typeof self !== 'undefined' ? self : this, function (PalCalc) {
  'use strict';

  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var fmt = function (v) { v = r1(v); return Number.isInteger(v) ? String(v) : v.toFixed(1); };
  /* Unghiurile cu două zecimale: la fierăstrău 56.98° nu e 57°. */
  var fmtU = function (v) {
    var x = Math.round(v * 100) / 100;
    return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, '');
  };
  var grd = function (rad) { return rad * 180 / Math.PI; };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m];
    });
  };

  /* ---------- unelte de desen ----------

     Toate desenele sunt în milimetri (viewBox), iar textul și liniile se
     măsoară față de mărimea piesei (`k`), ca să se citească la fel la o
     poliță de 300 și la o latură de 3000. */

  function svg(vb, corp, eticheta) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(fmt).join(' ') +
      '" class="fisa-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      esc(eticheta || '') + '">' + corp + '</svg>';
  }

  /* Linie de cotă între două puncte, scoasă în afară cu `dep` pe normala ei,
     cu linii ajutătoare și liniuțe la capete. Textul stă pe mijloc, drept
     de-a lungul liniei (întors ca să se citească de jos sau din dreapta). */
  function cota(x1, y1, x2, y2, text, dep, k, cls) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L;
    var ax = x1 + nx * dep, ay = y1 + ny * dep, bx = x2 + nx * dep, by = y2 + ny * dep;
    var t = k * 0.35;                                   /* liniuța de la capăt */
    var ux = dx / L, uy = dy / L;
    var o = [];
    o.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + (ax + nx * t) + '" y2="' + (ay + ny * t) + '" class="fisa-ajut"/>');
    o.push('<line x1="' + x2 + '" y1="' + y2 + '" x2="' + (bx + nx * t) + '" y2="' + (by + ny * t) + '" class="fisa-ajut"/>');
    o.push('<line x1="' + ax + '" y1="' + ay + '" x2="' + bx + '" y2="' + by + '" class="fisa-cota-linie"/>');
    [[ax, ay], [bx, by]].forEach(function (p) {
      o.push('<line x1="' + (p[0] - (ux + nx) * t * 0.7) + '" y1="' + (p[1] - (uy + ny) * t * 0.7) +
             '" x2="' + (p[0] + (ux + nx) * t * 0.7) + '" y2="' + (p[1] + (uy + ny) * t * 0.7) + '" class="fisa-cota-linie"/>');
    });
    var ang = grd(Math.atan2(dy, dx));
    if (ang > 90 || ang <= -90) ang += 180;
    var mx = (ax + bx) / 2 + nx * k * 0.45, my = (ay + by) / 2 + ny * k * 0.45;
    o.push('<text x="' + mx + '" y="' + my + '" font-size="' + k + '" text-anchor="middle" dominant-baseline="middle" ' +
           'transform="rotate(' + r1(ang) + ' ' + mx + ' ' + my + ')" class="' + (cls || 'fisa-cota') + '">' + esc(text) + '</text>');
    return o.join('');
  }

  /* Arc de unghi în vârful `v`, între direcțiile spre `a` și spre `b`, cu
     valoarea scrisă înăuntru. */
  function arcUnghi(v, a, b, text, raza, k) {
    var a1 = Math.atan2(a[1] - v[1], a[0] - v[0]), a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
    var d = a2 - a1;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    var p1 = [v[0] + raza * Math.cos(a1), v[1] + raza * Math.sin(a1)];
    var p2 = [v[0] + raza * Math.cos(a1 + d), v[1] + raza * Math.sin(a1 + d)];
    var mij = a1 + d / 2, rt = raza + k * 0.9;
    return '<path d="M' + p1[0] + ' ' + p1[1] + ' A' + raza + ' ' + raza + ' 0 0 ' + (d > 0 ? 1 : 0) + ' ' +
           p2[0] + ' ' + p2[1] + '" class="fisa-arc"/>' +
           '<text x="' + (v[0] + rt * Math.cos(mij)) + '" y="' + (v[1] + rt * Math.sin(mij)) + '" font-size="' + (k * 0.9) +
           '" text-anchor="middle" dominant-baseline="middle" class="fisa-unghi">' + esc(text) + '</text>';
  }

  /* Unghiul interior al unui poligon în vârful i (grade). */
  function unghiInterior(pts, i, sens) {
    var n = pts.length, p = pts[(i - 1 + n) % n], v = pts[i], u = pts[(i + 1) % n];
    var a = Math.atan2(p[1] - v[1], p[0] - v[0]), b = Math.atan2(u[1] - v[1], u[0] - v[0]);
    var d = grd(sens > 0 ? a - b : b - a);
    while (d < 0) d += 360;
    while (d >= 360) d -= 360;
    return d;
  }

  function arie(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }

  /* Scoate punctele care se repetă sau stau pe aceeași dreaptă: pe desen ar
     ieși o latură de 0 mm și un unghi de 180°. */
  function curata(pts) {
    var out = [];
    pts.forEach(function (p) {
      var q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push([p[0], p[1]]);
    });
    if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
    var schimbat = true;
    while (schimbat && out.length > 3) {
      schimbat = false;
      for (var i = 0; i < out.length; i++) {
        var a = out[(i - 1 + out.length) % out.length], v = out[i], b = out[(i + 1) % out.length];
        var cr = (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]);
        if (Math.abs(cr) < 1e-6 * Math.hypot(v[0] - a[0], v[1] - a[1]) * Math.hypot(b[0] - v[0], b[1] - v[1]) + 1e-9) {
          out.splice(i, 1); schimbat = true; break;
        }
      }
    }
    return out;
  }

  /* ---------- 3D: izometric ----------

     Piesa e o prismă: un contur (în x,y) împins pe grosime (z). Se desenează
     în izometric, fețele din spate întâi, ca să le acopere cele din față. */
  var C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
  /* x spre dreapta-jos, z spre stânga-jos, y în sus: privit de sus, din față */
  function iso(p) { return [(p[0] - p[2]) * C30, (p[0] + p[2]) * S30 - p[1]]; }

  function prisma3d(contur, gros, eticheta, k) {
    var jos = contur.map(function (p) { return [p[0], p[1], 0]; });
    var sus = contur.map(function (p) { return [p[0], p[1], gros]; });
    var toate = jos.concat(sus).map(iso);
    var xs = toate.map(function (p) { return p[0]; }), ys = toate.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    var poly = function (pts, cls) {
      return '<polygon points="' + pts.map(function (p) { var q = iso(p); return fmt(q[0]) + ',' + fmt(q[1]); }).join(' ') +
             '" class="' + cls + '"/>';
    };
    var fete = [];
    for (var i = 0; i < contur.length; i++) {
      var j = (i + 1) % contur.length;
      var f = [jos[i], jos[j], sus[j], sus[i]];
      /* adâncimea feței: cu cât e mai mică, cu atât e mai în spate */
      var ad = f.reduce(function (s, p) { return s + p[0] + p[1] + p[2]; }, 0);
      fete.push({ f: f, ad: ad });
    }
    fete.sort(function (a, b) { return a.ad - b.ad; });
    var o = [poly(jos, 'fisa-3d-spate')];
    fete.forEach(function (x) { o.push(poly(x.f, 'fisa-3d-muchie')); });
    o.push(poly(sus, 'fisa-3d-fata'));
    return svg([x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad], o.join(''), eticheta);
  }

  /* ---------- piesa cu contur: spate, ușă, montant, poliță ---------- */

  function desenContur(pts0, t_, eticheta) {
    var pts = curata(pts0);
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    /* coordonate de desen: originea în colțul stânga-jos, y în jos în SVG */
    pts = pts.map(function (p) { return [p[0] - x0, p[1] - y0]; });
    var W = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
    var H = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    var k = Math.max(W, H) / 24;
    var S = function (p) { return [p[0], H - p[1]]; };
    var sens = arie(pts) > 0 ? 1 : -1;                  /* contra sau în sensul acelor */
    var o = [];

    o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="fisa-gabarit"/>');
    o.push('<polygon points="' + pts.map(function (p) { var q = S(p); return q[0] + ',' + q[1]; }).join(' ') +
           '" class="fisa-piesa"/>');

    /* fiecare latură, cotată pe dinafară */
    for (var i = 0; i < pts.length; i++) {
      var a = S(pts[i]), b = S(pts[(i + 1) % pts.length]);
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      /* în SVG y e întors, deci și sensul: afară e pe partea cealaltă */
      o.push(cota(a[0], a[1], b[0], b[1], fmt(L), sens * k * 1.8, k));
    }
    /* unghiul din fiecare colț, înăuntru */
    for (var v = 0; v < pts.length; v++) {
      var u = unghiInterior(pts, v, sens);
      var n = pts.length;
      o.push(arcUnghi(S(pts[v]), S(pts[(v - 1 + n) % n]), S(pts[(v + 1) % n]),
                      fmtU(u) + '°', k * 3, k));
    }
    /* dreptunghiul din care se taie, cotat separat */
    o.push(cota(0, H, W, H, t_('fisa.gabaritL', { mm: fmt(W) }), k * 5.2, k * 0.9, 'fisa-cota-gabarit'));
    o.push(cota(0, H, 0, 0, t_('fisa.gabaritH', { mm: fmt(H) }), -k * 5.2, k * 0.9, 'fisa-cota-gabarit'));

    var pad = k * 8;
    return {
      svg: svg([-pad, -pad, W + 2 * pad, H + 2 * pad], o.join(''), eticheta),
      W: W, H: H, pts: pts,
      laturi: pts.map(function (p, i) {
        var q = pts[(i + 1) % pts.length];
        return r1(Math.hypot(q[0] - p[0], q[1] - p[1]));
      }),
      unghiuri: pts.map(function (p, i) { return unghiInterior(pts, i, sens); })
    };
  }

  /* ---------- latura îmbinată în unghi ----------

     Panoul stă pe o latură a conturului; la fiecare capăt se întâlnește cu
     vecinul în unghiul colțului. Tăietura e la JUMĂTATE din unghiul ăla,
     măsurată față de fața piesei: la un colț drept, 45°. Cota din listă e
     pe muchia EXTERIOARĂ (cea lungă); cea interioară iese mai scurtă cu
     t / tan(unghi de tăiere) la fiecare capăt.

     La fierăstrău se dă înclinarea pânzei față de tăietura dreaptă: 90° minus
     unghiul de tăiere. La 45° e tot 45°; la celelalte NU — de-aia se scriu
     amândouă. */
  function desenLatura(L, D, t, a, b, cant, t_, eticheta) {
    var ra = a * Math.PI / 180, rb = b * Math.PI / 180;
    var dA = t / Math.tan(ra), dB = t / Math.tan(rb);
    var Lint = L - dA - dB;
    var k = Math.max(L, D) / 24;
    var desene = [];

    /* 1. Vederea de sus: fața exterioară, L × D, cu muchia interioară
          punctată la capete și muchia cantuită îngroșată. */
    var o = [];
    o.push('<rect x="0" y="0" width="' + L + '" height="' + D + '" class="fisa-piesa"/>');
    o.push('<line x1="' + dA + '" y1="0" x2="' + dA + '" y2="' + D + '" class="fisa-ascuns"/>');
    o.push('<line x1="' + (L - dB) + '" y1="0" x2="' + (L - dB) + '" y2="' + D + '" class="fisa-ascuns"/>');
    if (cant) o.push('<line x1="0" y1="' + D + '" x2="' + L + '" y2="' + D + '" class="fisa-cant"/>');
    o.push(cota(0, 0, L, 0, t_('fisa.exterior', { mm: fmt(L) }), -k * 2, k));
    o.push(cota(dA, D, L - dB, D, t_('fisa.interior', { mm: fmt(Lint) }), k * 2.4, k));
    o.push(cota(L, 0, L, D, fmt(D), k * 2, k));
    var pad = k * 6;
    desene.push({ titlu: t_('fisa.vedereSus'), svg: svg([-pad, -pad, L + 2 * pad, D + 2 * pad], o.join(''), eticheta) });

    /* 2. Secțiunea: capetele mărite, fiecare cu unghiul lui. */
    var cap = function (unghi, d, stanga, litera) {
      var z = Math.max(t * 3.2, d + t * 1.6);           /* cât din piesă se vede */
      var kk = z / 11;
      var q = [];
      /* piesa: exterior sus (y=0), interior jos (y=t) */
      var pts = stanga
        ? [[0, 0], [z, 0], [z, t], [d, t]]
        : [[0, 0], [z, 0], [z - d, t], [0, t]];
      q.push('<polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" class="fisa-piesa"/>');
      q.push('<line x1="' + (stanga ? z : 0) + '" y1="0" x2="' + (stanga ? z : 0) + '" y2="' + t + '" class="fisa-rupt"/>');
      var colt = stanga ? [0, 0] : [z, 0];
      var jos = stanga ? [d, t] : [z - d, t];
      var pe = stanga ? [z, 0] : [0, 0];
      /* Unghiul se arată mereu pe partea ascuțită: la tăietura obtuză față
         de fața exterioară, în colțul de pe fața interioară. */
      if (unghi > 90) {
        var peInt = stanga ? [z, t] : [0, t];
        q.push(arcUnghi(jos, peInt, colt, fmtU(180 - unghi) + '°', t * 0.9, kk));
      } else {
        q.push(arcUnghi(colt, pe, jos, fmtU(unghi) + '°', t * 0.9, kk));
      }
      q.push('<text x="' + (z / 2) + '" y="' + (-kk * 1.2) + '" font-size="' + kk + '" text-anchor="middle" class="fisa-cota">' +
             esc(t_('fisa.exteriorScurt')) + '</text>');
      q.push('<text x="' + (z / 2) + '" y="' + (t + kk * 1.8) + '" font-size="' + kk + '" text-anchor="middle" class="fisa-cota">' +
             esc(t_('fisa.interiorScurt')) + '</text>');
      q.push(cota(stanga ? 0 : z, 0, stanga ? 0 : z, t, fmt(t), stanga ? kk * 1.4 : -kk * 1.4, kk * 0.8));
      if (d > 0.5) q.push(cota(stanga ? 0 : z - d, t, stanga ? d : z, t, fmt(d), kk * 3.4, kk * 0.8));
      var pp = kk * 5;
      /* La un colț intrând (peste 180°) tăietura trece de 90° față de fața
         exterioară: se spune unghiul ascuțit, față de fața interioară. */
      return {
        titlu: unghi > 90
          ? t_('fisa.capatInterior', { lit: litera, u: fmtU(180 - unghi), panza: fmtU(Math.abs(90 - unghi)) })
          : t_('fisa.capat', { lit: litera, u: fmtU(unghi), panza: fmtU(90 - unghi) }),
        svg: svg([-pp, -pp, z + 2 * pp, t + 2 * pp], q.join(''), eticheta)
      };
    };
    desene.push(cap(a, dA, true, 'A'));
    desene.push(cap(b, dB, false, 'B'));

    /* 3. 3D: secțiunea împinsă pe adâncime. */
    var sect = [[0, t], [L, t], [L - dB, 0], [dA, 0]];
    desene.push({ titlu: t_('fisa.vedere3d'), svg: prisma3d(sect, D, eticheta, k) });

    return { desene: desene, Lint: r1(Lint), dA: r1(dA), dB: r1(dB) };
  }

  /* ---------- montantul de sub pantă ----------

     Montantul e o placă înaltă cât golul și adâncă cât corpul. Sus se
     oprește în panta de deasupra, iar panta urcă pe grosimea lui: o față e
     mai înaltă decât cealaltă cu t · tan(pantă). Muchia de sus se taie deci
     înclinat PE GROSIME, la unghiul pantei față de tăietura dreaptă. */
  function desenMontant(hMare, hMic, D, t, t_, eticheta) {
    var beta = Math.atan2(Math.max(0, hMare - hMic), t) * 180 / Math.PI;
    var k = Math.max(hMare, D) / 24;
    var desene = [];

    /* 1. Fața înaltă: D × hMare, cu muchia fețe joase punctată sus. */
    var o = [];
    o.push('<rect x="0" y="0" width="' + D + '" height="' + hMare + '" class="fisa-piesa"/>');
    if (hMare - hMic > 0.3) {
      o.push('<line x1="0" y1="' + (hMare - hMic) + '" x2="' + D + '" y2="' + (hMare - hMic) + '" class="fisa-ascuns"/>');
    }
    o.push('<line x1="' + D + '" y1="0" x2="' + D + '" y2="' + hMare + '" class="fisa-cant"/>');
    o.push(cota(0, hMare, 0, 0, t_('fisa.fataInalta', { mm: fmt(hMare) }), -k * 2.2, k));
    o.push(cota(D, hMare, D, hMare - hMic, t_('fisa.fataJoasa', { mm: fmt(hMic) }), k * 2.2, k));
    o.push(cota(0, hMare, D, hMare, fmt(D), k * 2, k));
    var pad = k * 6;
    desene.push({ titlu: t_('fisa.vedereSus'), svg: svg([-pad, -pad, D + 2 * pad, hMare + 2 * pad], o.join(''), eticheta) });

    /* 2. Muchia de sus, în secțiune pe grosime, mărită. */
    if (beta > 0.05) {
      var z = t * 2.4, dh = hMare - hMic, kk = z / 11, q = [];
      /* fața înaltă în stânga (x=0), cea joasă în dreapta (x=t); y în jos */
      var pts = [[0, 0], [t, dh], [t, z], [0, z]];
      q.push('<polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" class="fisa-piesa"/>');
      q.push('<line x1="0" y1="' + z + '" x2="' + t + '" y2="' + z + '" class="fisa-rupt"/>');
      q.push(arcUnghi([0, 0], [0, z], [t, dh], fmtU(90 - beta) + '°', t * 0.55, kk));
      q.push(cota(0, 0, t, 0, fmt(t), -kk * 1.6, kk * 0.8));
      q.push(cota(t, 0, t, dh, fmt(dh), kk * 1.6, kk * 0.8));
      var pp = kk * 5;
      desene.push({
        titlu: t_('fisa.montantSus', { u: fmtU(90 - beta), panza: fmtU(beta) }),
        svg: svg([-pp, -pp, t + 2 * pp, z + 2 * pp], q.join(''), eticheta)
      });
    }

    /* 3. 3D: secțiunea pe grosime, împinsă pe adâncime. */
    desene.push({ titlu: t_('fisa.vedere3d'),
                  svg: prisma3d([[0, 0], [t, 0], [t, hMic], [0, hMare]], D, eticheta, k) });
    return { desene: desene, beta: beta };
  }

  /* ---------- fișele unui corp ---------- */

  /* Rândul unui capăt de latură. La colțul ieșit (sub 180°) tăietura e
     ascuțită față de fața exterioară, iar fața interioară iese mai scurtă.
     La colțul intrând e invers: se spune unghiul față de fața interioară,
     care iese mai LUNGĂ. Fără semne minus pe foaia din atelier. */
  function randCapat(lit, u, d, t_) {
    return u > 90
      ? t_('fisa.rCapatInterior', { lit: lit, u: fmtU(180 - u), panza: fmtU(Math.abs(90 - u)), d: fmt(Math.abs(d)) })
      : t_('fisa.rCapat', { lit: lit, u: fmtU(u), panza: fmtU(90 - u), d: fmt(d) });
  }

  /* Întoarce o listă de fișe, câte una pe piesă (piesele cu mai multe
     bucăți identice ies o dată, cu numărul de bucăți). Numai la corpurile
     atipice: la cele drepte lista de debitare spune tot. */
  function fise(params, tr) {
    var t_ = PalCalc.traducator(tr);
    if (!params || params.tip !== 'atipic') return [];
    var res = PalCalc.calc(params, t_);
    var t = +params.t || 18, tp = +params.tp || 3;
    var out = [];
    /* Laturile conturului, în ordinea panourilor: unghiurile se iau de aici,
       exacte, nu din nota piesei (acolo sunt rotunjite pentru citit). */
    var laturi = (res.contur && res.contur.laturi) || [];
    var iLat = 0;

    res.P.forEach(function (p, idx) {
      var b = (p.boxes || [])[0] || {};
      var cod = String(idx + 1);
      var baza = { cod: cod, cheie: p.cheie, piesa: p.nume, buc: p.buc,
                   L: p.L, l: p.l, TL: p.TL, Tl: p.Tl, nota: p.nota || '' };

      if (p.cheie === 'panouLatura') {
        var lat = laturi[iLat++] || {};
        var a = (+lat.unghiStart || 90) / 2, bb = (+lat.unghiEnd || 90) / 2;
        var d = desenLatura(p.L, p.l, t, a, bb, p.c[0] === 'g', t_, p.nume);
        out.push(Object.assign(baza, {
          fel: 'latura', gros: t, desene: d.desene,
          randuri: [
            t_('fisa.rExterior', { mm: fmt(p.L) }),
            t_('fisa.rInterior', { mm: fmt(d.Lint) }),
            t_('fisa.rLatime', { mm: fmt(p.l), taiere: fmt(p.Tl) }),
            randCapat('A', a, d.dA, t_),
            randCapat('B', bb, d.dB, t_)
          ]
        }));
        return;
      }

      /* Tavanul de sub scară, între laterale: capetele tăiate VERTICAL,
         paralele. În secțiune e un paralelogram: aceeași lungime pe ambele
         fețe, iar tăietura e la (90° − pantă) față de fața de sus. */
      if (p.cheie === 'tavanPanta' && b.polyFata) {
        var pf = b.polyFata;
        var alfa = Math.atan2(Math.abs(pf[3][1] - pf[2][1]), Math.abs(pf[2][0] - pf[3][0])) * 180 / Math.PI;
        var dt = desenLatura(p.L, p.l, t, 90 - alfa, 90 + alfa, p.c[0] === 'g', t_, p.nume);
        out.push(Object.assign(baza, {
          fel: 'tavan', gros: t, desene: dt.desene,
          randuri: [
            t_('fisa.rTavanLung', { mm: fmt(p.L) }),
            t_('fisa.rLatime', { mm: fmt(p.l), taiere: fmt(p.Tl) }),
            t_('fisa.rTavanCapete', { u: fmtU(90 - alfa), panza: fmtU(alfa) }),
            t_('fisa.rGrosime', { mm: fmt(t) })
          ]
        }));
        return;
      }

      /* Montantul, și lateralele care stau pe bază la corpul de sub scară:
         amândouă sunt plăci verticale cu muchia de sus sub pantă. */
      if ((p.cheie === 'montantAtipic' || p.cheie === 'laterala') && b.polyFata) {
        var hs = b.polyFata.map(function (q) { return q[1]; });
        var y0m = Math.min.apply(null, hs);
        var hA = b.polyFata[3][1] - y0m, hB = b.polyFata[2][1] - y0m;
        var hMare = Math.max(hA, hB), hMic = Math.min(hA, hB);
        var dm = desenMontant(hMare, hMic, p.l, t, t_, p.nume);
        out.push(Object.assign(baza, {
          fel: 'montant', gros: t, desene: dm.desene,
          randuri: [
            t_('fisa.rFataInalta', { mm: fmt(hMare) }),
            t_('fisa.rFataJoasa', { mm: fmt(hMic) }),
            t_('fisa.rAdancime', { mm: fmt(p.l), taiere: fmt(p.Tl) }),
            dm.beta > 0.05 ? t_('fisa.rMontantSus', { u: fmtU(90 - dm.beta), panza: fmtU(dm.beta) }) : null,
            t_('fisa.rGrosime', { mm: fmt(t) })
          ].filter(Boolean)
        }));
        return;
      }

      /* piese cu contur: din `polyFata`, altfel dreptunghiul lor */
      var pts = b.polyFata ? b.polyFata : [[0, 0], [p.l, 0], [p.l, p.L], [0, p.L]];
      if (p.cheie === 'polita') pts = [[0, 0], [p.L, 0], [p.L, p.l], [0, p.l]];
      var gros = p.cheie === 'spateAtipic' ? tp : t;
      var dc = desenContur(pts, t_, p.nume);
      var desene = [{ titlu: t_('fisa.vedereFata'), svg: dc.svg },
                    { titlu: t_('fisa.vedere3d'), svg: prisma3d(dc.pts, gros, p.nume, Math.max(dc.W, dc.H) / 32) }];
      var drept = dc.pts.length === 4 && dc.unghiuri.every(function (u) { return Math.abs(u - 90) < 0.05; });
      out.push(Object.assign(baza, {
        fel: drept ? 'dreptunghi' : 'contur', gros: gros, desene: desene,
        randuri: [
          drept ? t_('fisa.rDreptunghi', { a: fmt(dc.W), b: fmt(dc.H) })
                : t_('fisa.rGabarit', { a: fmt(dc.W), b: fmt(dc.H) }),
          t_('fisa.rLaturi', { lista: dc.laturi.map(fmt).join(' · ') }),
          drept ? null : t_('fisa.rUnghiuri', { lista: dc.unghiuri.map(function (u) { return fmtU(u) + '°'; }).join(' · ') }),
          t_('fisa.rGrosime', { mm: fmt(gros) }),
          drept ? null : t_('fisa.rTaiereDreapta')
        ].filter(Boolean)
      }));
    });
    return out;
  }

  return { fise: fise, desenLatura: desenLatura, desenContur: desenContur, unghiInterior: unghiInterior };
});
