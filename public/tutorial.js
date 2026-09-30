/* „Cum funcționează": scenele cu setările corpului, ca un film.

   Fiecare pas vine gata calculat de la server (src/tutorial.js): piesele
   corpului ca liste de fețe, lista de debitare și textul. Aici se desenează
   izometric — doar fețele întoarse spre privitor, piesele din spate întâi —
   iar piesele care apar la un pas se aprind. Scara rămâne aceeași pe toată
   scena, ca o lățire să se vadă ca lățire.

   Filmul merge singur, de la o scenă la alta; se poate opri, da înapoi sau
   sări la o scenă. Adresa #scena duce direct la scena ei. */
(function () {
  'use strict';

  var el = document.getElementById('tutorial');
  if (!el) return;
  var TX = JSON.parse(document.getElementById('tutorial-texte').textContent);
  var svg = el.querySelector('.tut-svg');
  var NS = 'http://www.w3.org/2000/svg';
  var LAT = 560, INALT = 470;
  var linistit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = function (s) { return el.querySelector(s); };
  var scapa = function (x) {
    return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var fmt = function (s, a) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return a[k] != null ? a[k] : m; }); };

  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b4532a';
  var CULORI = { pal: '#f3e9d8', front: '#b4532a', pfl: '#c9b18e', maner: '#2b2520', sticla: '#d6e6ec' };
  function nuanta(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.min(255, Math.round(v * f)); });
    return '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
  }
  var pr = function (p) { return [(p[0] - p[2]) * 0.866, (p[0] + p[2]) * 0.5 - p[1]]; };

  var SCENE = [], si = 0, pi = 0, timer = null, merge = !linistit;

  /* ---------- geometria ---------- */

  function pregateste(piesa) {
    if (piesa._gata) return piesa;
    var pts = [];
    piesa.f.forEach(function (fata) { fata.forEach(function (p) { pts.push(p); }); });
    piesa.min = [0, 1, 2].map(function (k) { return Math.min.apply(null, pts.map(function (p) { return p[k]; })); });
    piesa.max = [0, 1, 2].map(function (k) { return Math.max.apply(null, pts.map(function (p) { return p[k]; })); });
    piesa.c = [0, 1, 2].map(function (k) { return (piesa.min[k] + piesa.max[k]) / 2; });
    piesa.s = piesa.c[0] + piesa.c[1] + piesa.c[2];
    piesa._gata = true;
    return piesa;
  }

  function ordoneaza(P) {
    var inSpate = function (a, b) {
      return [0, 1, 2].some(function (k) { return a.max[k] <= b.min[k] + 0.5; });
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

  /* Scara scenei: toate pașii încap în același cadru. */
  function scara(scena) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    scena.pasi.forEach(function (pas) {
      var E = Math.max(260, 0.28 * Math.max(pas.W, pas.H, pas.D)) * (pas.explod || 0);
      pas.piese.forEach(function (piesa) {
        pregateste(piesa);
        piesa.f.forEach(function (fata) {
          fata.forEach(function (p) {
            var e = pr([p[0] + piesa.ex[0] * E, p[1] + piesa.ex[1] * E, p[2] + piesa.ex[2] * E]);
            x0 = Math.min(x0, e[0]); x1 = Math.max(x1, e[0]); y0 = Math.min(y0, e[1]); y1 = Math.max(y1, e[1]);
          });
        });
      });
    });
    var pad = 30;
    var s = Math.min((LAT - 2 * pad) / (x1 - x0), (INALT - 2 * pad) / (y1 - y0));
    return { s: s, ox: (LAT - (x1 - x0) * s) / 2 - x0 * s, oy: (INALT - (y1 - y0) * s) / 2 - y0 * s };
  }

  function deseneaza(scena, pas, noi) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var sc = scena._scara || (scena._scara = scara(scena));
    var E = Math.max(260, 0.28 * Math.max(pas.W, pas.H, pas.D)) * (pas.explod || 0);
    ordoneaza(pas.piese.map(pregateste)).forEach(function (piesa) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'tut-piesa' + (noi[piesa.k] ? ' noua' : ''));
      var dx = piesa.ex[0] * E, dy = piesa.ex[1] * E, dz = piesa.ex[2] * E;
      piesa.f.forEach(function (fata) {
        var n = [0, 0, 0];
        for (var i = 0; i < fata.length; i++) {
          var a = fata[i], b = fata[(i + 1) % fata.length];
          n[0] += (a[1] - b[1]) * (a[2] + b[2]);
          n[1] += (a[2] - b[2]) * (a[0] + b[0]);
          n[2] += (a[0] - b[0]) * (a[1] + b[1]);
        }
        var fc = [0, 1, 2].map(function (k) { return fata.reduce(function (s, p) { return s + p[k]; }, 0) / fata.length; });
        if ((fc[0] - piesa.c[0]) * n[0] + (fc[1] - piesa.c[1]) * n[1] + (fc[2] - piesa.c[2]) * n[2] < 0) n = n.map(function (v) { return -v; });
        if (n[0] + n[1] + n[2] <= 1e-6) return;
        var ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
        var f = ay >= ax && ay >= az ? 1.04 : az >= ax ? 0.93 : 0.8;
        var d = fata.map(function (p, i) {
          var e = pr([p[0] + dx, p[1] + dy, p[2] + dz]);
          return (i ? 'L' : 'M') + (sc.ox + e[0] * sc.s).toFixed(1) + ' ' + (sc.oy + e[1] * sc.s).toFixed(1);
        }).join(' ') + ' Z';
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', nuanta(piesa.mat === 'front' ? accent : (CULORI[piesa.mat] || CULORI.pal), f));
        if (piesa.mat === 'sticla') path.setAttribute('fill-opacity', '0.45');
        path.setAttribute('stroke', '#2b2520');
        path.setAttribute('stroke-width', '1.1');
        path.setAttribute('stroke-linejoin', 'round');
        g.appendChild(path);
      });
      svg.appendChild(g);
    });
  }

  /* ---------- pasul curent ---------- */

  function arata(noiScena) {
    var scena = SCENE[si], pas = scena.pasi[pi];
    var inainte = !noiScena && pi > 0 ? scena.pasi[pi - 1] : null;
    var aveam = {};
    if (inainte) inainte.piese.forEach(function (p) { aveam[p.k] = true; });
    var noi = {};
    if (inainte) pas.piese.forEach(function (p) { if (!aveam[p.k]) noi[p.k] = true; });
    deseneaza(scena, pas, noi);

    q('.tut-scena-titlu').textContent = scena.titlu;
    q('.tut-pas').textContent = fmt(TX.pasDin, { n: pi + 1, total: scena.pasi.length });
    q('.tut-text').textContent = pas.text;
    q('.tut-cote').textContent = pas.cote + ' · ' + fmt(TX.piese, { n: pas.nrPiese });
    q('.tut-lista').innerHTML = pas.debitare.map(function (r) {
      return '<li><span>' + scapa(r.nume) + ' <span class="muted">× ' + r.buc + '</span></span>' +
             '<b title="' + scapa(TX.colTaiere) + '">' + scapa(r.taiere) + '</b></li>';
    }).join('');
    q('.tut-puncte').innerHTML = scena.pasi.map(function (x, k) {
      return '<span class="' + (k === pi ? 'on' : k < pi ? 'trecut' : '') + '"></span>';
    }).join('');
    el.querySelectorAll('.tut-scene button').forEach(function (b, k) {
      b.classList.toggle('on', k === si);
      if (k === si) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    q('.tut-play').textContent = merge ? TX.pauza : TX.porneste;
  }

  function urmatorul() {
    if (pi < SCENE[si].pasi.length - 1) { pi++; arata(false); }
    else { si = (si + 1) % SCENE.length; pi = 0; arata(true); }
  }
  function anteriorul() {
    if (pi > 0) { pi--; arata(true); }
    else { si = (si - 1 + SCENE.length) % SCENE.length; pi = SCENE[si].pasi.length - 1; arata(true); }
  }

  function porneste() { opreste(); if (merge) timer = setInterval(urmatorul, 3200); }
  function opreste() { clearInterval(timer); timer = null; }

  /* ---------- butoane ---------- */

  q('.tut-urm').addEventListener('click', function () { urmatorul(); porneste(); });
  q('.tut-ant').addEventListener('click', function () { anteriorul(); porneste(); });
  q('.tut-play').addEventListener('click', function () { merge = !merge; arata(true); porneste(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) opreste(); else porneste(); });

  function laScena(id) {
    var k = SCENE.findIndex(function (s) { return s.id === id; });
    if (k === -1) return false;
    si = k; pi = 0; arata(true); porneste();
    return true;
  }
  window.addEventListener('hashchange', function () { laScena(location.hash.slice(1)); });

  /* ---------- datele ---------- */

  fetch('/cum-functioneaza/date.json?lang=' + encodeURIComponent(document.documentElement.lang || ''))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      SCENE = d.scene;
      q('.tut-scene').innerHTML = SCENE.map(function (s, k) {
        return '<button type="button" data-k="' + k + '">' + scapa(s.titlu) + '</button>';
      }).join('');
      q('.tut-scene').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        si = Number(b.dataset.k); pi = 0;
        if (history.replaceState) history.replaceState(null, '', '#' + SCENE[si].id);
        arata(true); porneste();
      });
      if (!laScena(location.hash.slice(1))) { arata(true); porneste(); }
    })
    .catch(function () { q('.tut-text').textContent = '—'; });
})();
