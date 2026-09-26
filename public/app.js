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
  var atipic = tip === 'atipic';
  var arata = function (id, da) { var el = $(id); if (el) el.classList.toggle('hidden', !da); };

  arata('wrapW2', colt);
  arata('wrapOrb', tip === 'colt-orb');
  arata('wrapConstr', !colt && !atipic);
  arata('conturBox', atipic);
  var wrapW = $('W') ? $('W').closest('label') : null;
  var wrapH = $('H') ? $('H').closest('label') : null;
  if (wrapW) wrapW.classList.toggle('hidden', atipic);
  if (wrapH) wrapH.classList.toggle('hidden', atipic);

  $('labelW').textContent = T(colt ? 'editor.laturaPerete1' : 'editor.latime');
  $('labelD').textContent = T((colt || atipic) ? 'editor.adancimeBrate' : 'editor.adancime');
  if (atipic) $('labelD').textContent = T('editor.adancimeCorp');

  var nota = $('notaColt');
  nota.classList.toggle('hidden', tip === 'drept');
  if (tip === 'colt-orb') {
    nota.textContent = T('editor.notaColtOrb');
  } else if (colt) {
    nota.textContent = T('editor.notaColtL');
  } else if (atipic) {
    nota.textContent = T('editor.notaAtipic');
    if (!params.contur || !params.contur.length) {
      params.contur = window.PalCalc.conturImplicit(+params.W || 800, +params.H || 720);
    }
    var tbody = $('conturTabel');
    if (!tbody || tbody.children.length !== params.contur.length) randeazaContur();
    else actualizeazaContur();
  }
}

/* ---------------- conturul corpului atipic ---------------- */

/* Rândurile se redesenează doar când se schimbă numărul de laturi: altfel
   câmpul în care scrii ar fi înlocuit la fiecare tastă și ai pierde cursorul. */
function randeazaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;
  var contur = params.contur || [];

  tbody.innerHTML = contur.map(function (s, i) {
    return '<tr>' +
      '<td class="c" style="color:var(--muted)">' + (i + 1) + '</td>' +
      '<td class="small" data-nume="' + i + '">—</td>' +
      '<td class="c"><input class="dim" type="number" min="10" max="4000" step="1" ' +
        'data-contur="' + i + '" data-camp="lung" value="' + s.lung + '"></td>' +
      '<td class="c"><input class="dim" type="number" min="1" max="359" step="0.5" ' +
        'data-contur="' + i + '" data-camp="unghi" value="' + s.unghi + '"></td>' +
      '<td class="c"><button type="button" class="mini danger" title="' + T('editor.stergeLatura') +
        '" data-sterge-latura="' + i + '">✕</button></td>' +
      '</tr>';
  }).join('');

  actualizeazaContur();
}

/* numele laturilor, starea conturului și desenul — fără a atinge câmpurile */
function actualizeazaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;

  var g = window.PalCalc.conturGeometrie(params.contur || []);
  g.laturi.forEach(function (l, i) {
    var cel = tbody.querySelector('[data-nume="' + i + '"]');
    if (cel) cel.textContent = window.PalCalc.numeDirectie(l.dir, T);
  });

  var stare = $('conturStare');
  var scapa = function (x) {
    return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  if (g.inchis) {
    stare.innerHTML = '<span style="color:var(--accent)">' + scapa(T('editor.conturInchis')) + '</span> ' +
      scapa(T('editor.conturRezumat', { W: g.W, H: g.H, laturi: g.nrLaturi, suma: g.sumaUnghiuri }));
  } else {
    stare.innerHTML = '<span style="color:var(--danger)">' + scapa(T('editor.conturDeschis')) + '</span> ' +
      scapa(T('editor.conturRamas', { mm: g.eroare, laturi: g.nrLaturi,
                                      ceruta: g.sumaCeruta, suma: g.sumaUnghiuri }));
  }

  $('conturPreview').innerHTML = desenContur(g);
}

function desenContur(g) {
  if (!g.puncte.length) return '';
  var W = Math.max(g.W, 10), H = Math.max(g.H, 10);
  var pad = Math.max(W, H) * 0.16;
  var fs = Math.max(W, H) / 22;
  var o = [];

  o.push('<polygon points="' + g.puncte.map(function (p) {
    return p[0] + ',' + (H - p[1]);
  }).join(' ') + '" class="ct-forma"/>');

  g.laturi.forEach(function (l, i) {
    var x1 = l.de_la[0], y1 = H - l.de_la[1], x2 = l.la[0], y2 = H - l.la[1];
    o.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="ct-latura"/>');
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    o.push('<text x="' + mx + '" y="' + my + '" class="ct-cota" text-anchor="middle" ' +
           'dominant-baseline="central" font-size="' + fs + '">' + (i + 1) + ': ' + l.lung + '</text>');
  });

  if (!g.inchis) {
    var p0 = g.puncte[0];
    var ultim = g.laturi[g.laturi.length - 1];
    if (ultim) {
      o.push('<line x1="' + ultim.la[0] + '" y1="' + (H - ultim.la[1]) + '" x2="' + p0[0] +
             '" y2="' + (H - p0[1]) + '" class="ct-lipsa"/>');
    }
  }

  return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) +
         '" class="ct-svg" preserveAspectRatio="xMidYMid meet">' + o.join('') + '</svg>';
}

function legaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;

  tbody.addEventListener('input', function (e) {
    var i = e.target.dataset.contur;
    if (i === undefined) return;
    params.contur[+i][e.target.dataset.camp] = +e.target.value;
    actualizeazaContur();
    render();
    scheduleSave();
  });

  tbody.addEventListener('click', function (e) {
    var i = e.target.dataset.stergeLatura;
    if (i === undefined) return;
    params.contur.splice(+i, 1);
    randeazaContur(); render(); scheduleSave();
  });

  $('conturAdauga').onclick = function () {
    var ultim = params.contur[params.contur.length - 1] || { lung: 400, unghi: 90 };
    params.contur.push({ lung: ultim.lung, unghi: 90 });
    randeazaContur(); render(); scheduleSave();
  };

  /* adaugă latura care lipsește ca să se închidă conturul */
  $('conturInchide').onclick = function () {
    var g = window.PalCalc.conturGeometrie(params.contur);
    if (g.inchis) { toast(T('editor.conturDejaInchis')); return; }
    if (g.eroare < 1) return;
    params.contur.push({ lung: Math.round(g.eroare), unghi: 90 });
    randeazaContur(); render(); scheduleSave();
    toast(T('editor.conturAdaugat', { mm: Math.round(g.eroare) }));
  };

  $('conturReset').onclick = function () {
    params.contur = window.PalCalc.conturImplicit(+params.W || 800, +params.H || 720);
    randeazaContur(); render(); scheduleSave();
  };
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
  setState(T('editor.seSalveaza'));
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
    if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || T('editor.eroareSalvare')); });
    return r.json();
  }).then(function (j) {
    params = Object.assign(params, j.params);
    setState(T('editor.salvat'));
    return loadPieces();
  }).catch(function (e) {
    setState(e.message || T('editor.eroareSalvare'), 'danger');
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

/* Piesa corespunzatoare de la server, doar daca lista e sincronizata.
   Potrivirea se face pe cheia piesei, nu pe numele ei: numele se schimba
   cu limba, cheia nu. */
function srv(i, piesa) {
  if (!serverPieces || !serverPieces.paid) return null;
  var list = serverPieces.pieces;
  if (!list || !lastRes || list.length !== lastRes.P.length) return null;
  var p = list[i];
  return (p && p.cheie === piesa.cheie) ? p : null;
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
      locked = '<td class="locked" title="' + esc(T('editor.dupaPlata')) + '">🔒</td>' +
               '<td class="locked">🔒</td><td class="locked">🔒</td>';
    } else {
      var s = srv(i, p);
      locked = s
        ? '<td>' + cantHTML(s.c) + '</td>' +
          '<td class="num"><b>' + fmt(s.TL) + '</b></td>' +
          '<td class="num"><b>' + fmt(s.Tl) + '</b></td>'
        : '<td class="muted">…</td><td class="num muted">…</td><td class="num muted">…</td>';
    }
    return '<tr data-pi="' + i + '">' + free + locked +
           '<td>' + esc(p.fibraText) + '</td></tr>';
  }).join('');

  $('rows').innerHTML = rows;
}

function render() {
  fields.forEach(function (f) { if ($(f)) $(f).value = params[f]; });
  aplicaTip();

  var res = window.PalCalc.calc(params, T);
  lastRes = res;

  var nume = params.nume || T('editor.corp');
  $('titlu').textContent = T('editor.listaPiese') + ' – ' + nume;
  $('titlu3d').textContent = T('editor.vedere3d') + ' – ' + nume;

  var warns = (serverPieces && serverPieces.warn) ? serverPieces.warn : res.warn;
  $('warns').innerHTML = warns.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('');

  renderTable();
  $('formule').innerHTML = formule(params, res);
  build3D(params, res);
}

function formule(c, r) {
  var t = +c.t, l = [];
  var nota = c.spate === 'aplicat'
    ? T('editor.formulaNotaAplicat', { tp: c.tp })
    : T('editor.formulaNotaNut', { off: window.PalCalc.NUT_OFF, tp: c.tp });

  l.push(T('editor.formulaInterior', {
    W: c.W, H: c.H, t: t, Wint: fmt(r.Wint), Hint: fmt(r.Hint), Dint: fmt(r.Dint), nota: nota
  }));

  if (+c.nUsi > 0) {
    var sertare = +c.nSer > 0 ? T('editor.formulaMinusSertare') : '';
    l.push(c.montaj === 'aplicat'
      ? T('editor.formulaUsaAplicata', { W: c.W, H: c.H, rm: c.rm, ri: c.ri,
                                         n: (+c.nUsi) - 1, nUsi: c.nUsi, sertare: sertare })
      : T('editor.formulaUsaIncastrata', { Wint: fmt(r.Wint), Hint: fmt(r.Hint), rinc: c.rinc,
                                           ri: c.ri, n: (+c.nUsi) - 1, nUsi: c.nUsi, sertare: sertare }));
    l.push(T('editor.formulaBalamale'));
  }
  if (+c.nPol > 0) l.push(T('editor.formulaPolita', { jp: c.jp, rp: c.rp }));
  if (+c.nSer > 0) l.push(T('editor.formulaSertar', { jg: c.jg, ts: c.ts }));
  l.push(T('editor.formulaTaiere', { cg: c.cg, cs: c.cs }));

  return l.map(function (x) { return '<div>' + x + '</div>'; }).join('');
}

/* ---------------- 3D ---------------- */

var V3 = null;
var COL = { f: 0xd9c7a8, g: 0xd48a1e, s: 0xf1cf93, '-': 0xb09572, p: 0x7a6650 };
var ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
var FETE = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function init3D() {
  if (!window.THREE) {
    $('cvwrap').innerHTML = '<div class="nocv">' + esc(T('editor.fara3d')) + '</div>';
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

  V3 = { renderer: renderer, scene: scene, camera: camera, group: group, mats: mats, lineMat: lineMat,
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
  var clampR = function () { V3.r = Math.max(200, Math.min(30000, V3.r)); };

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
      V3.theta -= dx * 0.008;
      V3.phi = Math.max(0.08, Math.min(Math.PI - 0.08, V3.phi - dy * 0.008));
    } else if (ptrs.size === 2) {
      var d = dist(); if (d > 0) { V3.r *= lastD / d; lastD = d; clampR(); }
    }
  });
  cv.addEventListener('pointerup', function (e) {
    if (ptrs.size === 1 && moved < 6) pick(e);
    ptrs.delete(e.pointerId);
  });
  cv.addEventListener('pointercancel', function (e) { ptrs.delete(e.pointerId); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault(); V3.r *= Math.exp(e.deltaY * 0.0012); clampR();
  }, { passive: false });

  function pick(e) {
    var r = cv.getBoundingClientRect();
    var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                              -((e.clientY - r.top) / r.height) * 2 + 1);
    V3.ray.setFromCamera(v, camera);
    var hits = V3.ray.intersectObjects(V3.meshes.filter(function (m) { return m.visible; }), false);
    select(hits.length ? hits[0].object : null);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() {
    requestAnimationFrame(loop);
    if ($('auto').checked && !reduce) V3.theta += 0.004;
    var t = V3.target;
    camera.position.set(t.x + V3.r * Math.sin(V3.phi) * Math.sin(V3.theta),
                        t.y + V3.r * Math.cos(V3.phi),
                        t.z + V3.r * Math.sin(V3.phi) * Math.cos(V3.theta));
    camera.lookAt(t);
    renderer.render(scene, camera);
  })();
}

function build3D(c, res) {
  if (!V3) return;
  var g = V3.group;
  while (g.children.length) {
    var m = g.children[0]; g.remove(m);
    if (m.geometry) m.geometry.dispose();
    m.children.forEach(function (ch) { ch.geometry && ch.geometry.dispose(); });
  }
  V3.meshes = []; select(null);

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
        mat = V3.mats[b.f.py || 'f'];
        base = [b.x, b.y, b.z];
      } else if (b.polyFata) {
        /* panou vertical decupat după contur (corp atipic): forma e chiar în planul frontal */
        var shapeF = new THREE.Shape();
        b.polyFata.forEach(function (pt, i) {
          if (i) shapeF.lineTo(pt[0], pt[1]); else shapeF.moveTo(pt[0], pt[1]);
        });
        geo = new THREE.ExtrudeGeometry(shapeF, { depth: b.sz, bevelEnabled: false });
        mat = V3.mats[b.f.pz || 'f'];
        base = [b.x, b.y, b.z];
      } else {
        geo = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
        mat = ORDER.map(function (k) { return V3.mats[b.f[k] || '-']; });
        base = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
      }

      var mesh = new THREE.Mesh(geo, mat);
      if (b.ry) mesh.rotation.y = b.ry;
      if (b.rz) mesh.rotation.z = b.rz;
      mesh.userData = { p: p, pi: pi, bi: bi, b: b, base: base };
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), V3.lineMat));
      g.add(mesh); V3.meshes.push(mesh);
    });
  });

  var prevMax = V3.maxDim || 0, maxDim = Math.max(res.W, res.H, res.D);
  V3.target.set(res.W / 2, res.H / 2, res.D / 2);
  if (Math.abs(prevMax - maxDim) > 1) { V3.r = maxDim * 2.9; V3.maxDim = maxDim; }
  applyExplode(); applyVis();
}

function applyExplode() {
  if (!V3) return;
  var E = V3.E;
  V3.meshes.forEach(function (m) {
    var b = m.userData.b, o = m.userData.base;
    m.position.set(o[0] + b.ex[0] * E, o[1] + b.ex[1] * E, o[2] + b.ex[2] * E);
  });
  if (V3.helper) V3.helper.update();
}

function applyVis() {
  if (!V3) return;
  var on = {};
  document.querySelectorAll('.vis').forEach(function (cb) { on[cb.dataset.g] = cb.checked; });
  V3.meshes.forEach(function (m) { m.visible = !!on[m.userData.b.grp]; });
  if (V3.sel && !V3.sel.visible) select(null);
}

function select(mesh) {
  if (!V3) return;
  if (V3.helper) { V3.scene.remove(V3.helper); V3.helper.geometry.dispose(); V3.helper = null; }
  V3.sel = mesh;
  document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.remove('sel'); });

  if (!mesh) {
    $('info').innerHTML = '<span class="muted">' + esc(T('editor.apasaPiesa')) + '</span>';
    return;
  }

  var helper = new THREE.BoxHelper(mesh, 0x0f6e6a);
  helper.material.linewidth = 2;
  V3.scene.add(helper); V3.helper = helper;

  var p = mesh.userData.p, b = mesh.userData.b, pi = mesh.userData.pi;
  var tr = document.querySelector('#rows tr[data-pi="' + pi + '"]');
  if (tr) tr.classList.add('sel');

  var formaLibera = !!(b.poly || b.polyFata);
  var th = b.poly ? b.sy : b.polyFata ? b.sz : Math.min(b.sx, b.sy, b.sz);
  /* la panourile decupate cantul nu se poate descrie pe cele 4 muchii: e în notă */
  var cants = formaLibera ? [] : ORDER.filter(function (k) { return b.f[k] !== 'f' && b.f[k] !== 'p'; })
    .map(function (k) {
      return T('fata.' + k) + ' ' + (b.f[k] === 'g' ? params.cg : b.f[k] === 's' ? params.cs : '–');
    });

  var s = srv(pi, p);
  var taiere = paid
    ? (s ? '<div>' + esc(T('editor.taiere')) + ' <span class="k"><b>' +
           fmt(s.TL) + ' × ' + fmt(s.Tl) + '</b></span> mm</div>'
         : '<div class="muted">' + esc(T('editor.taiereAstept')) + '</div>')
    : '<div class="muted">🔒 ' + esc(T('editor.taiereBlocata')) + '</div>';

  $('info').innerHTML =
    '<div><b>' + esc(p.nume) + '</b> <span class="tag">' +
      esc(T('editor.nBuc', { n: p.buc })) + '</span></div>' +
    '<div>' + esc(T('editor.finit')) + ' <span class="k">' +
      fmt(p.L) + ' × ' + fmt(p.l) + ' × ' + fmt(r1(th)) + '</span> mm</div>' +
    taiere +
    (paid && !formaLibera
      ? '<div>' + esc(T('editor.cantPeMuchii', {
          muchii: cants.length ? cants.join(', ') : T('editor.faraCant') })) + '</div>'
      : '') +
    (p.nota ? '<div class="tag">' + esc(p.nota) + '</div>' : '');
}

function setView(v) {
  if (!V3) return;
  var m = { iso: [0.65, 1.15], fata: [0, Math.PI / 2], sus: [0, 0.12], spate: [Math.PI, Math.PI / 2 - 0.15] }[v];
  V3.theta = m[0]; V3.phi = m[1];
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
  if (V3) { V3.E = (+e.target.value) / 100 * 260; applyExplode(); }
});
document.querySelectorAll('.vis').forEach(function (cb) { cb.addEventListener('change', applyVis); });
$('rows').addEventListener('click', function (e) {
  var tr = e.target.closest('tr[data-pi]');
  if (!tr || !V3) return;
  var pi = +tr.dataset.pi;
  var m = V3.meshes.find(function (x) { return x.userData.pi === pi && x.visible; });
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
          return navigator.clipboard.writeText(txt).then(function () { toast(T('editor.copiat')); });
        }
        var ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast(T('editor.copiat')); }
        catch (e) { toast(T('editor.copiazaManual')); }
        document.body.removeChild(ta);
      })
      .catch(function () { toast(T('editor.nuSaCopiat')); });
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
legaContur();
render();
loadPieces();
setState('salvat');

})();
