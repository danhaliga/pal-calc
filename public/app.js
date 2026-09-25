/* Editorul de corp: formular + vedere 3D + lista de piese.
   Portat din calculator-debitare.html, adaptat pentru cont si plata.

   Regula de aur: coloanele platite (cant, taiere) vin EXCLUSIV de la server
   (GET /api/corps/:id/pieces). calc() ruleaza local doar pentru 3D si cotele finite. */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
var DATA = JSON.parse($('page-data').textContent);
var CORP_ID = DATA.corpId;
var params = DATA.params;
var paid = !!DATA.paid;

var fields = ['nume','tip','W','H','D','W2','orb','constr','t','cg','cs','spate','tp','nUsi','montaj','balama',
              'rm','ri','rinc','nPol','jp','rp','nSer','hFront','hCutie','jg','ts','lg'];

/* ce câmpuri are sens să vadă utilizatorul, în funcție de tipul corpului */
function aplicaTip() {
  var tip = params.tip || 'drept';
  var colt = tip === 'colt-L' || tip === 'colt-diagonal';
  var arata = function (id, da) { var el = $(id); if (el) el.classList.toggle('hidden', !da); };

  arata('wrapW2', colt);
  arata('wrapOrb', tip === 'colt-orb');
  arata('wrapConstr', !colt);
  $('labelW').textContent = colt ? 'Latura pe peretele 1' : 'Lățime (L)';
  $('labelD').textContent = colt ? 'Adâncime brațe' : 'Adâncime (A)';

  var nota = $('notaColt');
  nota.classList.toggle('hidden', tip === 'drept');
  if (tip === 'colt-orb') {
    nota.textContent = 'Corp dreptunghiular normal: doar frontul este mai îngust, ' +
      'pentru că restul rămâne acoperit de corpul vecin.';
  } else if (colt) {
    nota.textContent = 'Blatul, fundul și polițele nu sunt dreptunghiuri: se debitează dreptunghiul ' +
      'de gabarit din listă, apoi se decupează colțul după nota fiecărei piese. Sertarele nu se calculează aici.';
  }
}

var fmt = function (v) { return Number.isInteger(v) ? String(v) : Number(v).toFixed(1); };
var r1 = function (v) { return Math.round(v * 10) / 10; };
function esc(s) { return String(s).replace(/[&<>"]/g, function (m) {
  return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

var serverPieces = null;  /* raspunsul curent de la server (sursa pentru coloanele platite) */
var lastRes = null;       /* rezultatul calc() local, pentru 3D si cote finite */

/* ---------------- salvare ---------------- */

var saveTimer = null, saving = false, dirty = false;

function setState(txt, cls) {
  var el = $('saveState');
  if (!el) return;
  el.textContent = txt;
  el.className = 'small ' + (cls || 'muted');
}

function scheduleSave() {
  dirty = true;
  setState('se salvează…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

function save() {
  if (saving) { scheduleSave(); return; }
  saving = true;
  dirty = false;

  fetch('/api/corps/' + CORP_ID, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': DATA.csrf },
    body: JSON.stringify({ name: params.nume, params: params })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'Eroare la salvare'); });
    return r.json();
  }).then(function (j) {
    params = Object.assign(params, j.params);
    setState('salvat');
    return loadPieces();
  }).catch(function (e) {
    setState(e.message || 'nesalvat', 'danger');
  }).finally(function () {
    saving = false;
    if (dirty) scheduleSave();
  });
}

/* piesele de la server: singura sursa pentru cant si cotele de taiere */
function loadPieces() {
  return fetch('/api/corps/' + CORP_ID + '/pieces', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      serverPieces = j;
      paid = !!j.paid;
      renderTable();
    })
    .catch(function () { /* lista ramane cu valorile libere */ });
}

/* ---------------- randare ---------------- */

function cantHTML(c) {
  var m = { g: 'g', s: 's', '-': '' };
  return '<span class="cant">' + c.map(function (v) {
    return '<span class="' + m[v] + '">' + (v === 'g' ? params.cg : v === 's' ? params.cs : '–') + '</span>';
  }).join('') + '</span>';
}

/* piesa corespunzatoare de la server, doar daca lista este sincronizata */
function srv(i, nume) {
  if (!serverPieces || !serverPieces.paid) return null;
  var list = serverPieces.pieces;
  if (!list || !lastRes || list.length !== lastRes.P.length) return null;
  var p = list[i];
  return (p && p.nume === nume) ? p : null;
}

function renderTable() {
  if (!lastRes) return;
  var rows = lastRes.P.map(function (p, i) {
    var free = '<td>' + esc(p.nume) + (p.nota ? '<div class="tag">' + esc(p.nota) + '</div>' : '') + '</td>' +
               '<td class="num">' + p.buc + '</td>' +
               '<td class="num">' + fmt(p.L) + '</td>' +
               '<td class="num">' + fmt(p.l) + '</td>';
    var locked;
    if (!paid) {
      locked = '<td class="locked" title="Se deblochează după plată">🔒</td>' +
               '<td class="locked">🔒</td><td class="locked">🔒</td>';
    } else {
      var s = srv(i, p.nume);
      locked = s
        ? '<td>' + cantHTML(s.c) + '</td>' +
          '<td class="num"><b>' + fmt(s.TL) + '</b></td>' +
          '<td class="num"><b>' + fmt(s.Tl) + '</b></td>'
        : '<td class="muted">…</td><td class="num muted">…</td><td class="num muted">…</td>';
    }
    return '<tr data-pi="' + i + '">' + free + locked + '<td>' + p.fibra + '</td></tr>';
  }).join('');

  $('rows').innerHTML = rows;
}

function render() {
  fields.forEach(function (f) { if ($(f)) $(f).value = params[f]; });
  aplicaTip();

  var res = window.PalCalc.calc(params);
  lastRes = res;

  $('titlu').textContent = 'Listă piese – ' + (params.nume || 'Corp');
  $('titlu3d').textContent = 'Vedere 3D – ' + (params.nume || 'Corp');

  var warns = (serverPieces && serverPieces.warn) ? serverPieces.warn : res.warn;
  $('warns').innerHTML = warns.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('');

  renderTable();
  $('formule').innerHTML = formule(params, res);
  build3D(params, res);
}

function formule(c, r) {
  var t = +c.t, l = [];
  l.push('Interior: <code>L_int = ' + c.W + ' − 2×' + t + ' = ' + fmt(r.Wint) + '</code>, ' +
         '<code>H_int = ' + c.H + ' − 2×' + t + ' = ' + fmt(r.Hint) + '</code>, ' +
         '<code>A_int = ' + fmt(r.Dint) + '</code>' +
         (c.spate === 'aplicat' ? ' (adâncime − spate ' + c.tp + ')'
                                : ' (adâncime − ' + window.PalCalc.NUT_OFF + ' mm nut − spate ' + c.tp + ')'));
  if (+c.nUsi > 0) {
    if (c.montaj === 'aplicat') {
      l.push('Ușă aplicată: <code>L_ușă = (' + c.W + ' − 2×' + c.rm + ' − ' + ((+c.nUsi) - 1) + '×' + c.ri + ') / ' + c.nUsi + '</code>, ' +
             '<code>H_ușă = ' + c.H + ' − 2×' + c.rm + (+c.nSer > 0 ? ' − fronturi sertar' : '') + '</code>');
    } else {
      l.push('Ușă încastrată: <code>L_ușă = (' + fmt(r.Wint) + ' − 2×' + c.rinc + ' − ' + ((+c.nUsi) - 1) + '×' + c.ri + ') / ' + c.nUsi + '</code>, ' +
             '<code>H_ușă = ' + fmt(r.Hint) + ' − 2×' + c.rinc + (+c.nSer > 0 ? ' − fronturi sertar' : '') + '</code>');
    }
    l.push('Balamale după înălțime: ≤900 → 2, ≤1600 → 3, ≤2000 → 4, peste → 5. ' +
           'Cupă Ø35, la 3–6 mm de muchie, 80–100 mm de capete.');
  }
  if (+c.nPol > 0) l.push('Poliță: <code>L = L_int − ' + c.jp + '</code>, <code>l = A_int − ' + c.rp + '</code>');
  if (+c.nSer > 0) l.push('Sertar cu glisiere cu bilă: <code>L_cutie = L_int − 2×' + c.jg + '</code>; ' +
                          'față/spate cutie = L_cutie − 2×' + c.ts + '; lungime glisieră ≤ A_int, pas 50 mm.');
  l.push('Tăiere: <code>cotă_tăiere = cotă_finită − cant_stânga − cant_dreapta</code> ' +
         '(cant gros ' + c.cg + ', subțire ' + c.cs + ').');
  return l.map(function (x) { return '<div>' + x + '</div>'; }).join('');
}

/* ---------------- 3D ---------------- */

var T = null;
var COL = { f: 0xd9c7a8, g: 0xd48a1e, s: 0xf1cf93, '-': 0xb09572, p: 0x7a6650 };
var ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
var FACE_RO = { px: 'dreapta', nx: 'stânga', py: 'sus', ny: 'jos', pz: 'față', nz: 'spate' };

function init3D() {
  if (!window.THREE) {
    $('cvwrap').innerHTML = '<div class="nocv">Vederea 3D nu s-a putut încărca ' +
      '(biblioteca 3D este blocată). Lista de piese funcționează normal.</div>';
    return;
  }
  var cv = $('cv'), wrap = $('cvwrap');
  var renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 10, 50000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66625a, 0.95));
  var dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(0.8, 1.6, 1.2); scene.add(dl);
  var dl2 = new THREE.DirectionalLight(0xffffff, 0.25); dl2.position.set(-1, 0.4, -0.8); scene.add(dl2);
  var group = new THREE.Group(); scene.add(group);
  var mats = {}; Object.keys(COL).forEach(function (k) { mats[k] = new THREE.MeshLambertMaterial({ color: COL[k] }); });
  var lineMat = new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.45 });

  T = { renderer: renderer, scene: scene, camera: camera, group: group, mats: mats, lineMat: lineMat,
        theta: 0.65, phi: 1.15, r: 2000, target: new THREE.Vector3(), meshes: [], sel: null,
        helper: null, ray: new THREE.Raycaster(), E: 0 };

  function resize() {
    var w = wrap.clientWidth || 600, h = Math.max(300, Math.min(480, Math.round(w * 0.62)));
    renderer.setSize(w, h, false); cv.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  else window.addEventListener('resize', resize);

  var ptrs = new Map(), moved = 0, lastD = 0;
  var dist = function () { var a = Array.from(ptrs.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  var clampR = function () { T.r = Math.max(200, Math.min(30000, T.r)); };

  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; if (ptrs.size === 2) lastD = dist();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = ptrs.get(e.pointerId); if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      T.theta -= dx * 0.008;
      T.phi = Math.max(0.08, Math.min(Math.PI - 0.08, T.phi - dy * 0.008));
    } else if (ptrs.size === 2) {
      var d = dist(); if (d > 0) { T.r *= lastD / d; lastD = d; clampR(); }
    }
  });
  cv.addEventListener('pointerup', function (e) {
    if (ptrs.size === 1 && moved < 6) pick(e);
    ptrs.delete(e.pointerId);
  });
  cv.addEventListener('pointercancel', function (e) { ptrs.delete(e.pointerId); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault(); T.r *= Math.exp(e.deltaY * 0.0012); clampR();
  }, { passive: false });

  function pick(e) {
    var r = cv.getBoundingClientRect();
    var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                              -((e.clientY - r.top) / r.height) * 2 + 1);
    T.ray.setFromCamera(v, camera);
    var hits = T.ray.intersectObjects(T.meshes.filter(function (m) { return m.visible; }), false);
    select(hits.length ? hits[0].object : null);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() {
    requestAnimationFrame(loop);
    if ($('auto').checked && !reduce) T.theta += 0.004;
    var t = T.target;
    camera.position.set(t.x + T.r * Math.sin(T.phi) * Math.sin(T.theta),
                        t.y + T.r * Math.cos(T.phi),
                        t.z + T.r * Math.sin(T.phi) * Math.cos(T.theta));
    camera.lookAt(t);
    renderer.render(scene, camera);
  })();
}

function build3D(c, res) {
  if (!T) return;
  var g = T.group;
  while (g.children.length) {
    var m = g.children[0]; g.remove(m);
    if (m.geometry) m.geometry.dispose();
    m.children.forEach(function (ch) { ch.geometry && ch.geometry.dispose(); });
  }
  T.meshes = []; select(null);

  res.P.forEach(function (p, pi) {
    p.boxes.forEach(function (b, bi) {
      var geo, mat, base;

      if (b.poly) {
        /* panou de colț: contur în plan, extrudat pe grosimea PAL-ului.
           Forma se desenează în XY și se culcă pe orizontală, deci z se inversează. */
        var shape = new THREE.Shape();
        b.poly.forEach(function (pt, i) {
          if (i) shape.lineTo(pt[0], -pt[1]); else shape.moveTo(pt[0], -pt[1]);
        });
        geo = new THREE.ExtrudeGeometry(shape, { depth: b.sy, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        mat = T.mats[b.f.py || 'f'];
        base = [b.x, b.y, b.z];
      } else {
        geo = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
        mat = ORDER.map(function (k) { return T.mats[b.f[k] || '-']; });
        base = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
      }

      var mesh = new THREE.Mesh(geo, mat);
      if (b.ry) mesh.rotation.y = b.ry;
      mesh.userData = { p: p, pi: pi, bi: bi, b: b, base: base };
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), T.lineMat));
      g.add(mesh); T.meshes.push(mesh);
    });
  });

  var prevMax = T.maxDim || 0, maxDim = Math.max(res.W, res.H, res.D);
  T.target.set(res.W / 2, res.H / 2, res.D / 2);
  if (Math.abs(prevMax - maxDim) > 1) { T.r = maxDim * 2.9; T.maxDim = maxDim; }
  applyExplode(); applyVis();
}

function applyExplode() {
  if (!T) return;
  var E = T.E;
  T.meshes.forEach(function (m) {
    var b = m.userData.b, o = m.userData.base;
    m.position.set(o[0] + b.ex[0] * E, o[1] + b.ex[1] * E, o[2] + b.ex[2] * E);
  });
  if (T.helper) T.helper.update();
}

function applyVis() {
  if (!T) return;
  var on = {};
  document.querySelectorAll('.vis').forEach(function (cb) { on[cb.dataset.g] = cb.checked; });
  T.meshes.forEach(function (m) { m.visible = !!on[m.userData.b.grp]; });
  if (T.sel && !T.sel.visible) select(null);
}

function select(mesh) {
  if (!T) return;
  if (T.helper) { T.scene.remove(T.helper); T.helper.geometry.dispose(); T.helper = null; }
  T.sel = mesh;
  document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.remove('sel'); });

  if (!mesh) {
    $('info').innerHTML = '<span class="muted">Apasă pe o piesă pentru cotele ei. ' +
      'Fiecare piesă este desenată la grosimea reală; culorile muchiilor arată cantul.</span>';
    return;
  }

  var helper = new THREE.BoxHelper(mesh, 0x0f6e6a);
  helper.material.linewidth = 2;
  T.scene.add(helper); T.helper = helper;

  var p = mesh.userData.p, b = mesh.userData.b, pi = mesh.userData.pi;
  var tr = document.querySelector('#rows tr[data-pi="' + pi + '"]');
  if (tr) tr.classList.add('sel');

  var th = b.poly ? b.sy : Math.min(b.sx, b.sy, b.sz);
  /* la panourile de colț cantul nu se poate descrie pe cele 4 muchii: e în notă */
  var cants = b.poly ? [] : ORDER.filter(function (k) { return b.f[k] !== 'f' && b.f[k] !== 'p'; })
    .map(function (k) {
      return FACE_RO[k] + ' ' + (b.f[k] === 'g' ? params.cg : b.f[k] === 's' ? params.cs : '–');
    });

  var s = srv(pi, p.nume);
  var taiere = paid
    ? (s ? '<div>tăiere <span class="k"><b>' + fmt(s.TL) + ' × ' + fmt(s.Tl) + '</b></span> mm</div>'
         : '<div class="muted">tăiere: se actualizează…</div>')
    : '<div class="muted">tăiere: 🔒 se deblochează după plată</div>';

  $('info').innerHTML =
    '<div><b>' + esc(p.nume) + '</b> <span class="tag">' + (p.buc > 1 ? p.buc + ' buc' : '1 buc') + '</span></div>' +
    '<div>finit <span class="k">' + fmt(p.L) + ' × ' + fmt(p.l) + ' × ' + fmt(r1(th)) + '</span> mm</div>' +
    taiere +
    (paid && !b.poly ? '<div>cant: ' + (cants.length ? cants.join(', ') : 'fără') + '</div>' : '') +
    (p.nota ? '<div class="tag">' + esc(p.nota) + '</div>' : '');
}

function setView(v) {
  if (!T) return;
  var m = { iso: [0.65, 1.15], fata: [0, Math.PI / 2], sus: [0, 0.12], spate: [Math.PI, Math.PI / 2 - 0.15] }[v];
  T.theta = m[0]; T.phi = m[1];
}

/* ---------------- evenimente ---------------- */

$('form').addEventListener('input', function (e) {
  var f = e.target.id;
  if (fields.indexOf(f) === -1) return;
  params[f] = e.target.type === 'number'
    ? (e.target.value === '' ? '' : +e.target.value)
    : e.target.value;
  render();
  scheduleSave();
});

document.querySelectorAll('[data-view]').forEach(function (b) {
  b.onclick = function () { setView(b.dataset.view); };
});
$('explode').addEventListener('input', function (e) {
  if (T) { T.E = (+e.target.value) / 100 * 260; applyExplode(); }
});
document.querySelectorAll('.vis').forEach(function (cb) { cb.addEventListener('change', applyVis); });
$('rows').addEventListener('click', function (e) {
  var tr = e.target.closest('tr[data-pi]');
  if (!tr || !T) return;
  var pi = +tr.dataset.pi;
  var m = T.meshes.find(function (x) { return x.userData.pi === pi && x.visible; });
  select(m || null);
});

var copyBtn = $('copyCorp');
if (copyBtn) {
  copyBtn.onclick = function () {
    fetch('/corps/' + CORP_ID + '/export.csv')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('indisponibil')); })
      .then(function (txt) {
        txt = txt.replace(/^﻿/, '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(txt).then(function () { toast('CSV copiat.'); });
        }
        var ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast('CSV copiat.'); }
        catch (e) { toast('Selectează și copiază manual.'); }
        document.body.removeChild(ta);
      })
      .catch(function () { toast('CSV-ul nu a putut fi copiat.'); });
  };
}

var tt;
function toast(m) {
  var t = $('toast');
  t.textContent = m; t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
}

/* ---------------- pornire ---------------- */

init3D();
render();
loadPieces();
setState('salvat');

})();
