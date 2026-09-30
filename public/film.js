/* „Filmul" de pe pagina de prezentare: un corp din catalog, desenat
   izometric, se desface piesă cu piesă, iar alături se aprind pe rând lista
   de debitare, planșa CNC și fișa de montaj. Datele vin de la server
   (src/film.js), calculate cu motorul aplicației; aici doar se desenează.

   Fără bibliotecă: fiecare piesă e o cutie cu 8 colțuri, din care se
   desenează doar fețele întoarse spre privitor (privim dinspre +x +y +z),
   în ordinea „ce e în spate, întâi". */
(function () {
  'use strict';

  var el = document.getElementById('film');
  var dateEl = document.getElementById('film-date');
  if (!el || !dateEl) return;
  var DATE = JSON.parse(dateEl.textContent);
  var CORPURI = DATE.corpuri || [];
  if (!CORPURI.length) return;

  var svg = el.querySelector('.film-svg');
  var NS = 'http://www.w3.org/2000/svg';
  var LAT = 520, INALT = 470;
  var linistit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b4532a';
  var CULORI = { pal: '#f3e9d8', front: accent, pfl: '#c9b18e', maner: '#2b2520', sticla: '#d6e6ec' };

  function nuanta(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.min(255, Math.round(v * f)); });
    return '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
  }

  var pr = function (p) { return [(p[0] - p[2]) * 0.866, (p[0] + p[2]) * 0.5 - p[1]]; };
  var FETE = [[0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6], [0, 1, 3, 2], [4, 6, 7, 5]];

  function colturi(b) {
    var c = [];
    for (var i = 0; i < 8; i++) {
      c.push([b.x + (i & 1 ? b.sx : 0), b.y + (i & 2 ? b.sy : 0), b.z + (i & 4 ? b.sz : 0)]);
    }
    return c;
  }

  /* Ordinea de desen: o piesă aflată cu totul în spatele alteia pe o axă
     se desenează înaintea ei; la egalitate, după suma coordonatelor. */
  function ordoneaza(P) {
    var inSpate = function (a, b) {
      return (a.b.x + a.b.sx <= b.b.x + 0.5) || (a.b.y + a.b.sy <= b.b.y + 0.5) || (a.b.z + a.b.sz <= b.b.z + 0.5);
    };
    var ramase = P.slice(), out = [];
    while (ramase.length) {
      var libere = ramase.filter(function (a) {
        return !ramase.some(function (b) { return b !== a && inSpate(b, a) && !inSpate(a, b); });
      });
      if (!libere.length) libere = ramase;
      libere.sort(function (a, b) { return a.s - b.s; });
      out.push(libere[0]);
      ramase.splice(ramase.indexOf(libere[0]), 1);
    }
    return out;
  }

  var grupuri = [];

  function deseneaza(corp) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    grupuri = [];
    var P = corp.cutii.map(function (b) {
      return { b: b, c: colturi(b), s: b.x + b.sx / 2 + b.y + b.sy / 2 + b.z + b.sz / 2 };
    });
    var E = Math.max(260, 0.28 * Math.max(corp.W, corp.H, corp.D));

    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    P.forEach(function (p) {
      p.c.forEach(function (c) {
        [0, 1].forEach(function (k) {
          var q = pr(k ? [c[0] + p.b.ex[0] * E, c[1] + p.b.ex[1] * E, c[2] + p.b.ex[2] * E] : c);
          x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
        });
      });
    });
    var pad = 24;
    var s = Math.min((LAT - 2 * pad) / (x1 - x0), (INALT - 2 * pad) / (y1 - y0));
    var ox = (LAT - (x1 - x0) * s) / 2 - x0 * s, oy = (INALT - (y1 - y0) * s) / 2 - y0 * s;

    ordoneaza(P).forEach(function (p) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'film-piesa');
      var cc = [0, 1, 2].map(function (k) { return p.c.reduce(function (a, q) { return a + q[k]; }, 0) / 8; });
      FETE.forEach(function (fi) {
        var pts = fi.map(function (i) { return p.c[i]; });
        var n = [0, 0, 0];
        for (var i = 0; i < 4; i++) {
          var a = pts[i], b = pts[(i + 1) % 4];
          n[0] += (a[1] - b[1]) * (a[2] + b[2]);
          n[1] += (a[2] - b[2]) * (a[0] + b[0]);
          n[2] += (a[0] - b[0]) * (a[1] + b[1]);
        }
        var fc = [0, 1, 2].map(function (k) { return pts.reduce(function (a, q) { return a + q[k]; }, 0) / 4; });
        if ((fc[0] - cc[0]) * n[0] + (fc[1] - cc[1]) * n[1] + (fc[2] - cc[2]) * n[2] < 0) n = n.map(function (v) { return -v; });
        if (n[0] + n[1] + n[2] <= 1e-6) return;
        var ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
        var f = ay >= ax && ay >= az ? 1.04 : az >= ax ? 0.93 : 0.8;
        var d = pts.map(function (q, i) {
          var e = pr(q);
          return (i ? 'L' : 'M') + (ox + e[0] * s).toFixed(1) + ' ' + (oy + e[1] * s).toFixed(1);
        }).join(' ') + ' Z';
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', nuanta(CULORI[p.b.mat] || CULORI.pal, f));
        if (p.b.mat === 'sticla') path.setAttribute('fill-opacity', '0.45');
        path.setAttribute('stroke', '#2b2520');
        path.setAttribute('stroke-width', '1.1');
        path.setAttribute('stroke-linejoin', 'round');
        g.appendChild(path);
      });
      var ex = p.b.ex, dx = ex[0] * E, dy = ex[1] * E, dz = ex[2] * E;
      g._tx = (dx - dz) * 0.866 * s; g._ty = ((dx + dz) * 0.5 - dy) * s;
      svg.appendChild(g);
      grupuri.push(g);
    });
  }

  function desface(k) {
    grupuri.forEach(function (g) {
      g.style.transform = 'translate(' + (g._tx * k).toFixed(1) + 'px,' + (g._ty * k).toFixed(1) + 'px)';
    });
  }

  /* ---------- cartonașele ---------- */

  var q = function (sel) { return el.querySelector(sel); };
  var scapa = function (x) {
    return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  function planseCnc(c) {
    if (!c) return '';
    var zw = 120, zh = 118;
    var sc = Math.min(zw / c.l, zh / c.L);
    var w = c.l * sc, h = c.L * sc, x = 40 + (zw - w) / 2, y = 8 + (zh - h) / 2;
    var o = ['<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
             '" fill="#f3e9d8" stroke="#2b2520" stroke-width="1.2"/>',
             '<line x1="' + (x + w).toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (x + w).toFixed(1) + '" y2="' + (y + h).toFixed(1) +
             '" stroke="' + accent + '" stroke-width="3"/>'];
    var gaura = function (gx, gy, r) {
      o.push('<circle cx="' + (x + gx * sc).toFixed(1) + '" cy="' + (y + gy * sc).toFixed(1) + '" r="' + r +
             '" fill="#fffaf2" stroke="#2b2520" stroke-width="1"/>');
    };
    for (var i = 0; i < c.balamale; i++) {
      gaura(c.l - 22.5, 100 + i * (c.L - 200) / Math.max(1, c.balamale - 1), Math.max(2.5, 17.5 * sc).toFixed(1));
    }
    if (c.polite) [37, c.l - 37].forEach(function (gx) { [0.4, 0.5, 0.6].forEach(function (fy) { gaura(gx, c.L * fy, 1.6); }); });
    if (c.sertare) [0.2, 0.5, 0.8].forEach(function (fy) { [37, c.l / 2, c.l - 37].forEach(function (gx) { gaura(gx, c.L * fy, 1.6); }); });
    o.push('<line x1="' + x.toFixed(1) + '" y1="142" x2="' + (x + w).toFixed(1) + '" y2="142" stroke="#6c5f55" stroke-width=".8"/>');
    o.push('<text x="' + (x + w / 2).toFixed(1) + '" y="139" text-anchor="middle" font-size="9" fill="currentColor">' + c.l + '</text>');
    o.push('<line x1="' + (x - 10).toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (x - 10).toFixed(1) + '" y2="' + (y + h).toFixed(1) +
           '" stroke="#6c5f55" stroke-width=".8"/>');
    var tx = (x - 16).toFixed(1), ty = (y + h / 2).toFixed(1);
    o.push('<text x="' + tx + '" y="' + ty + '" text-anchor="middle" font-size="9" fill="currentColor" transform="rotate(-90 ' + tx + ' ' + ty + ')">' + c.L + '</text>');
    return '<svg viewBox="0 0 188 150" width="188" height="150" aria-hidden="true">' + o.join('') + '</svg>';
  }

  function cartonase(corp) {
    q('.film-nume').textContent = corp.nume;
    q('.film-cote').textContent = corp.cote;
    q('.film-debitare').innerHTML = corp.debitare.map(function (r) {
      return '<li><span>' + scapa(r.nume) + ' <span class="muted">× ' + r.buc + '</span></span><b>' + scapa(r.cote) + '</b></li>';
    }).join('');
    q('.film-cnc-piesa').textContent = corp.cnc ? corp.cnc.piesa : '';
    q('.film-cnc').innerHTML = planseCnc(corp.cnc);
    q('.film-cnc-nota').textContent = corp.cnc ? corp.cnc.nota : '';
    q('.film-montaj').innerHTML = corp.montaj.map(function (m) { return '<li>' + scapa(m) + '</li>'; }).join('');
  }

  /* ---------- timpul ---------- */

  var pasi = el.querySelectorAll('.film-pasi li');
  var carduri = el.querySelectorAll('.film-card');
  var bara = q('.film-progres span');
  var t = 0, curent = -1, timer = null;

  function cadru() {
    var pas = t % 4;
    var i = Math.floor(t / 4) % CORPURI.length;
    if (i !== curent) { curent = i; deseneaza(CORPURI[i]); cartonase(CORPURI[i]); desface(0); }
    /* desfăcut la planșa CNC și la montaj; strâns la alegere și la listă */
    desface(pas >= 2 ? 1 : 0);
    pasi.forEach(function (li, k) { li.classList.toggle('on', k === pas); });
    carduri.forEach(function (c, k) { c.classList.toggle('on', k + 1 === pas); });
    if (bara) bara.style.width = ((pas + 1) * 25) + '%';
  }

  function porneste() {
    if (timer || linistit) return;
    timer = setInterval(function () { t++; cadru(); }, 1800);
  }
  function opreste() { clearInterval(timer); timer = null; }

  /* Pașii se pot și apăsa: filmul sare acolo. */
  pasi.forEach(function (li, k) {
    li.addEventListener('click', function () { t = Math.floor(t / 4) * 4 + k; cadru(); });
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) opreste(); else porneste(); });

  cadru();
  if (linistit) { t = 2; cadru(); }
  porneste();
})();
