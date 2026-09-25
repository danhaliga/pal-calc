/* Vederea 3D a ansamblului: toate corpurile așezate în cameră.
   Fiecare corp e un grup mutat și rotit după peretele pe care stă. */
(function () {
'use strict';

var DATE = JSON.parse(document.getElementById('page-data').textContent);
var wrap = document.getElementById('anWrap');
var canvas = document.getElementById('anCanvas');
var info = document.getElementById('anInfo');

if (!window.THREE) {
  wrap.innerHTML = '<div class="nocv">Vederea 3D nu s-a putut încărca ' +
    '(biblioteca 3D este blocată). Planul și elevațiile funcționează normal.</div>';
  return;
}

var COL = { f: 0xd9c7a8, g: 0xd48a1e, s: 0xf1cf93, '-': 0xb09572, p: 0x7a6650 };
var ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(40, 1, 10, 100000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x66625a, 0.95));
var dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(0.7, 1.5, 1); scene.add(dl);
var dl2 = new THREE.DirectionalLight(0xffffff, 0.22); dl2.position.set(-1, 0.5, -0.7); scene.add(dl2);

var mats = {};
Object.keys(COL).forEach(function (k) { mats[k] = new THREE.MeshLambertMaterial({ color: COL[k] }); });
var lineMat = new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.4 });

var grupCorpuri = new THREE.Group();
var grupPereti = new THREE.Group();
scene.add(grupCorpuri);
scene.add(grupPereti);

var T = { theta: 0.85, phi: 1.15, r: 6000, target: new THREE.Vector3(), meshes: [] };

function resize() {
  var w = wrap.clientWidth || 600;
  var h = Math.max(340, Math.min(560, Math.round(w * 0.58)));
  renderer.setSize(w, h, false);
  canvas.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
else window.addEventListener('resize', resize);

/* ---------- controale ---------- */

var ptrs = new Map(), moved = 0, lastD = 0;
var dist = function () {
  var a = Array.from(ptrs.values());
  return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
};
var clampR = function () { T.r = Math.max(600, Math.min(40000, T.r)); };

canvas.addEventListener('pointerdown', function (e) {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (ptrs.size === 2) lastD = dist();
});
canvas.addEventListener('pointermove', function (e) {
  var p = ptrs.get(e.pointerId); if (!p) return;
  var dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) {
    T.theta -= dx * 0.008;
    T.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, T.phi - dy * 0.008));
  } else if (ptrs.size === 2) {
    var d = dist(); if (d > 0) { T.r *= lastD / d; lastD = d; clampR(); }
  }
});
canvas.addEventListener('pointerup', function (e) {
  if (ptrs.size === 1 && moved < 6) alege(e);
  ptrs.delete(e.pointerId);
});
canvas.addEventListener('pointercancel', function (e) { ptrs.delete(e.pointerId); });
canvas.addEventListener('wheel', function (e) {
  e.preventDefault(); T.r *= Math.exp(e.deltaY * 0.0012); clampR();
}, { passive: false });

var ray = new THREE.Raycaster();
function alege(e) {
  var r = canvas.getBoundingClientRect();
  var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                            -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(v, camera);
  var hits = ray.intersectObjects(T.meshes, false);
  if (!hits.length) { info.innerHTML = indiciu(); return; }
  var d = hits[0].object.userData;
  info.innerHTML = '<div><b>' + d.corp + '</b> — ' + d.piesa + '</div>' +
    '<div class="muted small">peretele ' + d.perete + ', la ' + d.d + ' mm de colț, ' +
    'înălțime ' + d.h + ' mm · <a href="/corps/' + d.id + '">deschide corpul</a></div>';
}

function indiciu() {
  return '<span class="muted">Trage pentru rotire, scroll pentru zoom, apasă pe un corp ' +
         'ca să vezi unde este așezat.</span>';
}

document.querySelectorAll('[data-vedere]').forEach(function (b) {
  b.onclick = function () {
    var v = { iso: [0.85, 1.15], fata: [0, Math.PI / 2 - 0.05], sus: [0, 0.12] }[b.dataset.vedere];
    T.theta = v[0]; T.phi = v[1];
  };
});

var chPereti = document.getElementById('anPereti');
if (chPereti) chPereti.onchange = function () { grupPereti.visible = chPereti.checked; };

/* ---------- construcția scenei ---------- */

function deseneazaPereti(cam) {
  var g = new THREE.PlaneGeometry(cam.A, cam.B);
  var podea = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x8d8f93 }));
  podea.rotation.x = -Math.PI / 2;
  podea.position.set(cam.A / 2, 0, cam.B / 2);
  grupPereti.add(podea);

  var matZid = new THREE.MeshLambertMaterial({ color: 0xbfc4c9, transparent: true, opacity: 0.35,
                                               side: THREE.DoubleSide });
  var zidA = new THREE.Mesh(new THREE.PlaneGeometry(cam.A, cam.H), matZid);
  zidA.position.set(cam.A / 2, cam.H / 2, 0);
  grupPereti.add(zidA);

  var zidB = new THREE.Mesh(new THREE.PlaneGeometry(cam.B, cam.H), matZid);
  zidB.rotation.y = Math.PI / 2;
  zidB.position.set(0, cam.H / 2, cam.B / 2);
  grupPereti.add(zidB);
}

function construieste(date) {
  var cam = date.camera;
  deseneazaPereti(cam);

  date.corpuri.forEach(function (corp) {
    var grup = new THREE.Group();
    grup.position.set(corp.origine.x, corp.origine.y, corp.origine.z);
    grup.rotation.y = corp.rotatie;

    corp.piese.forEach(function (piesa) {
      piesa.boxes.forEach(function (b) {
        var geo, material, pozitie;

        if (b.poly) {
          var shape = new THREE.Shape();
          b.poly.forEach(function (pt, i) {
            if (i) shape.lineTo(pt[0], -pt[1]); else shape.moveTo(pt[0], -pt[1]);
          });
          geo = new THREE.ExtrudeGeometry(shape, { depth: b.sy, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          material = mats[b.f.py] || mats.f;
          pozitie = [b.x, b.y, b.z];
        } else if (b.polyFata) {
          var sf = new THREE.Shape();
          b.polyFata.forEach(function (pt, i) {
            if (i) sf.lineTo(pt[0], pt[1]); else sf.moveTo(pt[0], pt[1]);
          });
          geo = new THREE.ExtrudeGeometry(sf, { depth: b.sz, bevelEnabled: false });
          material = mats[b.f.pz] || mats.f;
          pozitie = [b.x, b.y, b.z];
        } else {
          geo = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
          material = ORDER.map(function (k) { return mats[b.f[k] || '-']; });
          pozitie = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
        }

        var mesh = new THREE.Mesh(geo, material);
        mesh.position.set(pozitie[0], pozitie[1], pozitie[2]);
        if (b.ry) mesh.rotation.y = b.ry;
        if (b.rz) mesh.rotation.z = b.rz;
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
        mesh.userData = {
          id: corp.id, corp: corp.nume, piesa: piesa.nume,
          perete: corp.perete || '—', d: Math.round(corp.d || 0), h: Math.round(corp.origine.y)
        };
        grup.add(mesh);
        T.meshes.push(mesh);
      });
    });

    grupCorpuri.add(grup);
  });

  T.target.set(cam.A / 2, cam.H * 0.35, cam.B / 2);
  T.r = Math.max(cam.A, cam.B, cam.H) * 1.9;
}

(function bucla() {
  requestAnimationFrame(bucla);
  var t = T.target;
  camera.position.set(
    t.x + T.r * Math.sin(T.phi) * Math.sin(T.theta),
    t.y + T.r * Math.cos(T.phi),
    t.z + T.r * Math.sin(T.phi) * Math.cos(T.theta)
  );
  camera.lookAt(t);
  renderer.render(scene, camera);
})();

info.innerHTML = '<span class="muted">Se încarcă ansamblul…</span>';

fetch('/api/orders/' + DATE.orderId + '/ansamblu')
  .then(function (r) { return r.json(); })
  .then(function (date) {
    /* peretele și distanța, pentru eticheta de la selecție */
    construieste(date);
    resize();
    info.innerHTML = indiciu();
  })
  .catch(function () {
    info.innerHTML = '<span class="muted">Ansamblul nu s-a putut încărca.</span>';
  });
})();
