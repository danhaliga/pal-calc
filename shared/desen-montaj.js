/* ============================================================
   Desenul de montaj al unui corp: corpul desfăcut (explodat), cu numărul
   fiecărei piese — același număr ca în tabelul de lângă (1.1, 1.2 …).

   Dan: „verifică la toate corpurile să existe planșe de montaj". Pagina de
   montaj avea numai tabele; montatorul trebuia să ghicească ce piesă unde
   merge. Desenul se face din aceleași cutii ca vederea 3D din editor, deci
   orice fel de corp (drept, colț, sub scară, glisant…) iese singur.

   Proiecție oblică de cabinet: fața corpului în mărime adevărată, adâncimea
   pe diagonală, pe jumătate. Se văd fața, capacul și partea dreaptă.

   Se încarcă și pe server (CommonJS), și în browser (window.PalMontaj).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalMontaj = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KX = 0.42, KY = 0.30;                         /* direcția adâncimii pe hârtie */
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* x spre dreapta, y în sus, z spre privitor (fața corpului e la z mare).
     Pe hârtie: y în jos, iar ce e mai în spate urcă spre dreapta-sus. */
  function pr(p) { return [p[0] - p[2] * KX, -p[1] + p[2] * KY]; }
  /* cât de aproape e un punct de privitor: față, sus, dreapta */
  function aproape(p) { return p[2] + p[1] * 0.3 + p[0] * 0.3; }

  function rot(p, c, ry, rz) {
    var x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    if (rz) {
      var cz = Math.cos(rz), sz = Math.sin(rz);
      var x1 = x * cz - y * sz, y1 = x * sz + y * cz; x = x1; y = y1;
    }
    if (ry) {
      var cy = Math.cos(ry), sy = Math.sin(ry);
      var x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;
    }
    return [x + c[0], y + c[1], z + c[2]];
  }

  /* O cutie din calcul → fețele ei (liste de puncte 3D), deja depărtate cu
     `ex · E` ca la vederea „explodat". Trei feluri de cutii:
       - `poly`: contur în plan (x, z), înălțat pe y cu `sy` (colțuri);
       - `polyFata`: contur în fața corpului (x, y), împins pe z cu `sz`;
       - dreptunghi obișnuit, eventual rotit (`rz`, `ry`). */
  function fete(b, E) {
    var ex = b.ex || [0, 0, 0];
    var d = [ex[0] * E, ex[1] * E, ex[2] * E];
    var sus, jos;
    if (b.poly && b.poly.length) {
      jos = b.poly.map(function (q) { return [b.x + q[0], b.y, b.z + q[1]]; });
      sus = b.poly.map(function (q) { return [b.x + q[0], b.y + b.sy, b.z + q[1]]; });
    } else if (b.polyFata && b.polyFata.length) {
      jos = b.polyFata.map(function (q) { return [q[0], q[1], b.z]; });
      sus = b.polyFata.map(function (q) { return [q[0], q[1], b.z + b.sz]; });
    } else {
      var c = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
      var colt = function (x, y, z) {
        var p = [b.x + x * b.sx, b.y + y * b.sy, b.z + z * b.sz];
        return (b.ry || b.rz) ? rot(p, c, b.ry, b.rz) : p;
      };
      jos = [colt(0, 0, 0), colt(1, 0, 0), colt(1, 0, 1), colt(0, 0, 1)];
      sus = [colt(0, 1, 0), colt(1, 1, 0), colt(1, 1, 1), colt(0, 1, 1)];
      /* ca prisma de mai jos: „jos" și „sus" sunt cele două capace */
    }
    var muta = function (p) { return [p[0] + d[0], p[1] + d[1], p[2] + d[2]]; };
    jos = jos.map(muta); sus = sus.map(muta);
    var out = [jos.slice().reverse(), sus];
    for (var i = 0; i < jos.length; i++) {
      var j = (i + 1) % jos.length;
      out.push([jos[i], jos[j], sus[j], sus[i]]);
    }
    return out;
  }

  var CULORI = { corp: '#e6d3ae', fronturi: '#f3e6c9', polite: '#d8e5c4', sertare: '#e9dcc0',
                 spate: '#d6d2c8', manere: '#6b6b6b', sticla: '#cfe3ea' };

  /* `res` = PalCalc.calc(...), `poz` = numărul corpului în comandă. */
  function desen(res, poz) {
    var maxDim = Math.max(+res.W || 0, +res.H || 0, +res.D || 0, 100);
    var E = Math.max(200, maxDim * 0.22);
    var toate = [];                                 /* { fata, adanc, cls } */
    var etichete = [];

    var puneCutia = function (b, cls, cod) {
      var f = fete(b, E);
      var centru = [0, 0, 0], n = 0;
      f.forEach(function (fa) {
        var ad = fa.reduce(function (s, p) { return s + aproape(p); }, 0) / fa.length;
        toate.push({ fata: fa, adanc: ad, cls: cls });
        fa.forEach(function (p) { centru[0] += p[0]; centru[1] += p[1]; centru[2] += p[2]; n++; });
      });
      if (cod && n) {
        var cc = [centru[0] / n, centru[1] / n, centru[2] / n];
        etichete.push({ p: pr(cc), cod: cod, adanc: aproape(cc) });
      }
    };

    (res.P || []).forEach(function (p, i) {
      var cod = poz != null ? poz + '.' + (i + 1) : String(i + 1);
      (p.boxes || []).forEach(function (b) { puneCutia(b, b.grp || 'corp', cod); });
    });
    (res.sticla3d || []).forEach(function (b) { puneCutia(b, 'sticla', null); });
    (res.manere || []).forEach(function (b) { puneCutia(b, 'manere', null); });

    if (!toate.length) return '';
    toate.sort(function (a, b) { return a.adanc - b.adanc; });

    var xs = [], ys = [];
    toate.forEach(function (t) { t.fata.forEach(function (p) { var q = pr(p); xs.push(q[0]); ys.push(q[1]); }); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var lat = x1 - x0, inalt = y1 - y0, pad = Math.max(lat, inalt) * 0.05;
    var fs = Math.max(lat, inalt) / 34;

    var o = [];
    toate.forEach(function (t) {
      o.push('<polygon points="' + t.fata.map(function (p) { var q = pr(p); return r1(q[0]) + ',' + r1(q[1]); }).join(' ') +
             '" class="mnt-' + t.cls + '" fill="' + (CULORI[t.cls] || '#eee') + '"/>');
    });
    /* numerele pieselor, peste tot, cele din față ultimele */
    etichete.sort(function (a, b) { return a.adanc - b.adanc; });
    etichete.forEach(function (e) {
      o.push('<g class="mnt-eticheta"><circle cx="' + r1(e.p[0]) + '" cy="' + r1(e.p[1]) + '" r="' + r1(fs * 0.95) + '"/>' +
             '<text x="' + r1(e.p[0]) + '" y="' + r1(e.p[1]) + '" font-size="' + r1(fs * 0.8) +
             '" text-anchor="middle" dominant-baseline="central">' + e.cod + '</text></g>');
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [x0 - pad, y0 - pad, lat + 2 * pad, inalt + 2 * pad].map(r1).join(' ') +
           '" class="mnt-svg" preserveAspectRatio="xMidYMid meet" role="img">' + o.join('') + '</svg>';
  }

  return { desen: desen };
});
