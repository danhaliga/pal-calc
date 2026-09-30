/* Planificatorul 3D al ansamblului: toate corpurile comenzii, în cameră.

   Un corp se mută cu mâna, ca în planificatoarele magazinelor de mobilă:
   tragi de el și se așază pe peretele cel mai apropiat, cu fața spre cameră,
   lipit de colț sau de vecini când ajunge aproape. Se înroșește dacă intră
   în alt corp sau iese din cameră. Când îl lași, poziția se salvează, iar
   planul, elevațiile și tabelul de dedesubt se reîncarcă.

   Poziția unui corp e aceeași ca peste tot în aplicație: peretele, distanța
   de la colțul de start al peretelui și înălțimea de la podea (vezi
   shared/ansamblu.js). Tras de pe gol, desenul se rotește; cu două degete
   sau cu rotița se face zoom. */
(function () {
'use strict';

var DATE = JSON.parse(document.getElementById('page-data').textContent);
var TX = DATE.t || {};
var wrap = document.getElementById('anWrap');
var canvas = document.getElementById('anCanvas');
var info = document.getElementById('anInfo');
var stare = document.getElementById('anStare');
var CSRF = (document.querySelector('input[name="_csrf"]') || {}).value || '';

var scapa = function (x) {
  return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

if (!window.THREE) {
  wrap.innerHTML = '<div class="nocv">' + scapa(TX.nu3d) + '</div>';
  return;
}

/* ---------- scena ---------- */

var ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(40, 1, 10, 100000);
scene.add(new THREE.HemisphereLight(0xfffaf2, 0x6b5f55, 0.95));
var dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(0.7, 1.5, 1); scene.add(dl);
var dl2 = new THREE.DirectionalLight(0xffffff, 0.22); dl2.position.set(-1, 0.5, -0.7); scene.add(dl2);

var lineMat = new THREE.LineBasicMaterial({ color: 0x2b2520, transparent: true, opacity: 0.35 });
var grupCorpuri = new THREE.Group();
var grupPereti = new THREE.Group();
scene.add(grupCorpuri);
scene.add(grupPereti);

var T = { theta: 0.85, phi: 1.15, r: 6000, target: new THREE.Vector3(), meshes: [] };
var CAM = { A: 3200, B: 2400, H: 2500 };
var CORPURI = [];
var ales = null;
var pereti = [];   /* {mesh, normala} — se ascund cei dintre privitor și cameră */

function resize() {
  var w = wrap.clientWidth || 600;
  var h = Math.max(360, Math.min(620, Math.round(w * 0.6)));
  renderer.setSize(w, h, false);
  canvas.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
else window.addEventListener('resize', resize);

/* ---------- culori ---------- */

var CULOARE_IMPLICITA = '#e8dcc6';
var cacheMat = {};
function nuanta(hex, f) {
  var n = parseInt(String(hex || CULOARE_IMPLICITA).replace('#', ''), 16);
  if (isNaN(n)) n = parseInt(CULOARE_IMPLICITA.slice(1), 16);
  var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.min(255, Math.round(v * f)); });
  return (c[0] << 16) + (c[1] << 8) + c[2];
}
function material(hex, fata) {
  /* fața plăcii în culoarea decorului; cantul puțin mai închis, muchia
     brută și PFL-ul în culorile lor */
  var cul = fata === 'p' ? 0x9c8468 : fata === '-' ? 0xb8a07e :
            (fata === 'g' || fata === 's') ? nuanta(hex, 0.86) : nuanta(hex, 1);
  var k = cul + '';
  if (!cacheMat[k]) cacheMat[k] = new THREE.MeshLambertMaterial({ color: cul });
  return cacheMat[k];
}

/* ---------- camera și pereții ---------- */

function deseneazaPereti(cam) {
  while (grupPereti.children.length) grupPereti.remove(grupPereti.children[0]);
  pereti = [];
  var podea = new THREE.Mesh(new THREE.PlaneGeometry(cam.A, cam.B),
                             new THREE.MeshLambertMaterial({ color: 0xcdb99a }));
  podea.rotation.x = -Math.PI / 2;
  podea.position.set(cam.A / 2, 0, cam.B / 2);
  grupPereti.add(podea);

  var grila = new THREE.GridHelper(Math.max(cam.A, cam.B), Math.round(Math.max(cam.A, cam.B) / 500), 0xb09a78, 0xb09a78);
  grila.position.set(cam.A / 2, 1, cam.B / 2);
  grila.material.transparent = true; grila.material.opacity = 0.25;
  grupPereti.add(grila);

  var G = 80;  /* grosimea zidului, în afara camerei */
  var matZid = new THREE.MeshLambertMaterial({ color: 0xf1e9dd });
  [
    { w: cam.A + 2 * G, d: G, x: cam.A / 2, z: -G / 2, n: [0, 1] },
    { w: G, d: cam.B + 2 * G, x: -G / 2, z: cam.B / 2, n: [1, 0] },
    { w: cam.A + 2 * G, d: G, x: cam.A / 2, z: cam.B + G / 2, n: [0, -1] },
    { w: G, d: cam.B + 2 * G, x: cam.A + G / 2, z: cam.B / 2, n: [-1, 0] }
  ].forEach(function (z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(z.w, cam.H, z.d), matZid);
    m.position.set(z.x, cam.H / 2, z.z);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), lineMat));
    grupPereti.add(m);
    pereti.push({ mesh: m, n: z.n, x: z.x, z: z.z });
  });
}

/* ---------- geometria unei așezări (ca în shared/ansamblu.js) ---------- */

function lungimePerete(id) { return (id === 'A' || id === 'C') ? CAM.A : CAM.B; }
var ROT = { A: 0, B: 90, C: 180, D: 270 };

function asezare(c) {
  var W = c.W, D = c.D, d = c.d, x, z, plan;
  if (c.perete === 'A') { x = d; z = 0; plan = { x0: d, z0: 0, x1: d + W, z1: D }; }
  else if (c.perete === 'B') { x = 0; z = d + W; plan = { x0: 0, z0: d, x1: D, z1: d + W }; }
  else if (c.perete === 'C') { x = d + W; z = CAM.B; plan = { x0: d, z0: CAM.B - D, x1: d + W, z1: CAM.B }; }
  else { x = CAM.A; z = d; plan = { x0: CAM.A - D, z0: d, x1: CAM.A, z1: d + W }; }
  return { x: x, z: z, rot: ROT[c.perete] * Math.PI / 180, plan: plan };
}

function pune(c) {
  var a = asezare(c);
  c.grup.position.set(a.x, c.h, a.z);
  c.grup.rotation.y = a.rot;
  c.plan = a.plan;
}

/* Se lovește de ceva? De un corp (în plan și pe înălțime) sau de marginile camerei. */
function probleme(c) {
  var p = c.plan;
  if (p.x0 < -0.5 || p.z0 < -0.5 || p.x1 > CAM.A + 0.5 || p.z1 > CAM.B + 0.5 || c.h + c.H > CAM.H + 0.5) return true;
  return CORPURI.some(function (o) {
    if (o === c) return false;
    var q = o.plan;
    var px = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
    var pz = Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0);
    var py = Math.min(c.h + c.H, o.h + o.H) - Math.max(c.h, o.h);
    return px > 0.5 && pz > 0.5 && py > 0.5;
  });
}

function coloreaza() {
  CORPURI.forEach(function (c) {
    var rau = probleme(c);
    var sel = c === ales;
    c.grup.traverse(function (o) {
      if (!o.isMesh) return;
      if (!o.userData.matInitial) o.userData.matInitial = o.material;
      if (rau || sel) {
        var cheie = rau ? 'rau' : 'sel';
        if (!o.userData[cheie]) {
          var baza = Array.isArray(o.userData.matInitial) ? o.userData.matInitial : [o.userData.matInitial];
          var noi = baza.map(function (m) {
            var n = m.clone();
            n.emissive = new THREE.Color(rau ? 0xb3261e : 0xb4532a);
            n.emissiveIntensity = rau ? 0.55 : 0.25;
            return n;
          });
          o.userData[cheie] = Array.isArray(o.userData.matInitial) ? noi : noi[0];
        }
        o.material = o.userData[cheie];
      } else {
        o.material = o.userData.matInitial;
      }
    });
  });
}

/* ---------- construcția ---------- */

function construieste(date) {
  CAM = date.camera;
  deseneazaPereti(CAM);
  while (grupCorpuri.children.length) grupCorpuri.remove(grupCorpuri.children[0]);
  T.meshes = [];
  CORPURI = date.corpuri.map(function (corp) {
    var grup = new THREE.Group();
    var cul = corp.culori || {};
    corp.piese.forEach(function (piesa) {
      piesa.boxes.forEach(function (b) {
        var hex = b.grp === 'fronturi' ? (cul.front || cul.corp) : cul.corp;
        var geo, mat, poz;
        if (b.poly) {
          var shape = new THREE.Shape();
          b.poly.forEach(function (pt, i) { if (i) shape.lineTo(pt[0], -pt[1]); else shape.moveTo(pt[0], -pt[1]); });
          geo = new THREE.ExtrudeGeometry(shape, { depth: b.sy, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          mat = material(hex, b.f.py || 'f');
          poz = [b.x, b.y, b.z];
        } else if (b.polyFata) {
          var sf = new THREE.Shape();
          b.polyFata.forEach(function (pt, i) { if (i) sf.lineTo(pt[0], pt[1]); else sf.moveTo(pt[0], pt[1]); });
          geo = new THREE.ExtrudeGeometry(sf, { depth: b.sz, bevelEnabled: false });
          mat = material(hex, b.f.pz || 'f');
          /* conturul e deja în coordonatele corpului: doar z se mută */
          poz = [0, 0, b.z];
        } else {
          geo = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
          mat = ORDER.map(function (k) { return material(hex, b.f[k] || '-'); });
          poz = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
        }
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(poz[0], poz[1], poz[2]);
        if (b.ry) mesh.rotation.y = b.ry;
        if (b.rz) mesh.rotation.z = b.rz;
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
        mesh.userData = { corpId: corp.id };
        grup.add(mesh);
        T.meshes.push(mesh);
      });
    });
    grupCorpuri.add(grup);
    var c = { id: corp.id, nr: corp.nr, nume: corp.nume, W: corp.W, D: corp.D, H: corp.H,
              perete: corp.perete, d: corp.d, h: corp.h || 0, grup: grup };
    pune(c);
    return c;
  });
  coloreaza();
  T.target.set(CAM.A / 2, CAM.H * 0.3, CAM.B / 2);
  T.r = Math.max(CAM.A, CAM.B, CAM.H) * 1.9;
}

/* ---------- tragerea ---------- */

var ray = new THREE.Raycaster();
var podea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function vector(e) {
  var r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function corpSub(e) {
  ray.setFromCamera(vector(e), camera);
  var hits = ray.intersectObjects(T.meshes, false);
  if (!hits.length) return null;
  var id = hits[0].object.userData.corpId;
  var c = CORPURI.filter(function (x) { return x.id === id; })[0] || null;
  return c ? { c: c, punct: hits[0].point } : null;
}

/* Punctul de sub deget, pe planul orizontal de la înălțimea la care a fost
   apucat corpul: un corp suspendat se mută pe peretele lui, nu pe podeaua
   de sub el, care se vede în altă parte. */
function punctLa(e, y) {
  ray.setFromCamera(vector(e), camera);
  podea.constant = -y;
  var p = new THREE.Vector3();
  return ray.ray.intersectPlane(podea, p) ? p : null;
}
var lungSPe = function (per, p) { return (per === 'A' || per === 'C') ? p.x : p.z; };

/* Peretele cel mai apropiat de punct și poziția de-a lungul lui. */
function peretePentru(p, c) {
  var dist = { A: p.z, B: p.x, C: CAM.B - p.z, D: CAM.A - p.x };
  var per = Object.keys(dist).sort(function (a, b) { return dist[a] - dist[b]; })[0];
  var s = (per === 'A' || per === 'C') ? p.x : p.z;
  return { perete: per, d: s - c.W / 2 };
}

/* Lipirea: de colțuri și de vecinii de pe același perete, la aceeași înălțime. */
var PRAG_LIPIRE = 90;
function lipeste(c, per, d) {
  var L = lungimePerete(per);
  var tinte = [0, L - c.W];
  CORPURI.forEach(function (o) {
    if (o === c || o.perete !== per) return;
    var py = Math.min(c.h + c.H, o.h + o.H) - Math.max(c.h, o.h);
    if (py <= 0.5) return;
    tinte.push(o.d + o.W, o.d - c.W);
  });
  var best = d, bd = PRAG_LIPIRE;
  tinte.forEach(function (tt) { if (Math.abs(tt - d) < bd) { bd = Math.abs(tt - d); best = tt; } });
  if (best === d) best = Math.round(d / 5) * 5;
  return Math.max(0, Math.min(Math.max(0, L - c.W), best));
}

var ptrs = new Map(), moved = 0, lastD = 0, trag = null;
var dist2 = function () {
  var a = Array.from(ptrs.values());
  return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
};
var clampR = function () { T.r = Math.max(600, Math.min(40000, T.r)); };

canvas.addEventListener('pointerdown', function (e) {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (ptrs.size === 2) { lastD = dist2(); trag = null; return; }
  var sub = corpSub(e);
  if (sub) {
    var c = sub.c;
    alege(c);
    /* locul de unde a fost apucat, față de începutul corpului: altfel corpul
       ar sări cu mijlocul sub deget */
    trag = { c: c, y: sub.punct.y, perete: c.perete, off: lungSPe(c.perete, sub.punct) - c.d,
             inainte: { perete: c.perete, d: c.d, h: c.h } };
  } else {
    trag = null;
  }
});

canvas.addEventListener('pointermove', function (e) {
  var p = ptrs.get(e.pointerId); if (!p) return;
  var dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 2) {
    var d = dist2(); if (d > 0) { T.r *= lastD / d; lastD = d; clampR(); }
    return;
  }
  if (trag && moved > 4) {
    var pt = punctLa(e, trag.y);
    if (!pt) return;
    var c = trag.c;
    var np = peretePentru(pt, c);
    /* pe același perete se păstrează locul de unde a fost apucat */
    var d = np.perete === trag.perete ? lungSPe(np.perete, pt) - trag.off : np.d;
    if (np.perete !== trag.perete) { trag.perete = np.perete; trag.off = c.W / 2; }
    c.perete = np.perete;
    c.d = lipeste(c, np.perete, d);
    pune(c);
    coloreaza();
    arataPanou();
    return;
  }
  if (!trag) {
    T.theta -= dx * 0.008;
    T.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, T.phi - dy * 0.008));
  }
});

function ridica(e) {
  var aveam = trag;
  ptrs.delete(e.pointerId);
  trag = null;
  if (aveam && moved > 4) {
    var i = aveam.inainte, c = aveam.c;
    if (i.perete !== c.perete || Math.abs(i.d - c.d) > 0.5) salveaza(c);
  } else if (!aveam && moved < 6 && ptrs.size === 0) {
    alege(null);
  }
}
canvas.addEventListener('pointerup', ridica);
canvas.addEventListener('pointercancel', function (e) { ptrs.delete(e.pointerId); trag = null; });
canvas.addEventListener('wheel', function (e) {
  e.preventDefault(); T.r *= Math.exp(e.deltaY * 0.0012); clampR();
}, { passive: false });

/* Săgețile mută corpul ales: 10 mm, cu Shift 100 mm; sus/jos schimbă înălțimea. */
document.addEventListener('keydown', function (e) {
  if (!ales || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
  var pas = e.shiftKey ? 100 : 10;
  var c = ales;
  if (e.key === 'ArrowLeft') c.d = Math.max(0, c.d - pas);
  else if (e.key === 'ArrowRight') c.d = Math.min(Math.max(0, lungimePerete(c.perete) - c.W), c.d + pas);
  else if (e.key === 'ArrowUp') c.h = Math.min(CAM.H - c.H, c.h + pas);
  else if (e.key === 'ArrowDown') c.h = Math.max(0, c.h - pas);
  else if (e.key === 'Escape') { alege(null); return; }
  else return;
  e.preventDefault();
  pune(c); coloreaza(); arataPanou();
  salveazaAmanat(c);
});

/* ---------- panoul corpului ales ---------- */

function alege(c) {
  ales = c;
  coloreaza();
  arataPanou();
}

function arataPanou() {
  if (!ales) { info.innerHTML = '<span class="muted">' + scapa(TX.indiciu) + '</span>'; return; }
  var c = ales;
  var butoane = (DATE.pereti || []).map(function (p) {
    return '<button type="button" class="pastila' + (p.id === c.perete ? ' on' : '') + '" data-perete="' + p.id +
           '" title="' + scapa(p.nume) + '">' + p.id + '</button>';
  }).join('');
  var campuri = info.querySelector('[data-camp]');
  /* nu rescriem panoul cât timp omul scrie într-un câmp: i-am fura cursorul */
  if (campuri && info.dataset.corp === String(c.id) && info.contains(document.activeElement) &&
      document.activeElement.tagName === 'INPUT') return;
  info.dataset.corp = String(c.id);
  info.innerHTML =
    '<div class="an-sel">' +
      '<b>' + (c.nr != null ? c.nr + '. ' : '') + scapa(c.nume) + '</b>' +
      '<span class="muted small">' + c.W + ' × ' + c.H + ' × ' + c.D + ' mm</span>' +
      (probleme(c) ? '<span class="an-rau">' + scapa(TX.seSuprapune) + '</span>' : '') +
    '</div>' +
    '<div class="an-unelte">' +
      '<span class="an-et">' + scapa(TX.perete) + '</span>' + butoane +
      '<label>' + scapa(TX.deLaColt) + ' <input type="number" step="10" min="0" data-camp="d" value="' + Math.round(c.d) + '"></label>' +
      '<label>' + scapa(TX.inaltime) + ' <input type="number" step="10" min="0" data-camp="h" value="' + Math.round(c.h) + '"></label>' +
      '<button type="button" class="btn small" data-muta="-50" aria-label="' + scapa(TX.stanga) + '">◀</button>' +
      '<button type="button" class="btn small" data-muta="50" aria-label="' + scapa(TX.dreapta) + '">▶</button>' +
      (DATE.demo ? '' : '<a class="btn small" href="/corps/' + c.id + '">' + scapa(TX.deschide) + '</a>') +
    '</div>';
}

info.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || !ales) return;
  var c = ales;
  if (b.dataset.perete) {
    c.perete = b.dataset.perete;
    c.d = Math.min(c.d, Math.max(0, lungimePerete(c.perete) - c.W));
  } else if (b.dataset.muta) {
    c.d = Math.max(0, Math.min(Math.max(0, lungimePerete(c.perete) - c.W), c.d + Number(b.dataset.muta)));
  } else return;
  pune(c); coloreaza(); arataPanou(); salveaza(c);
});

info.addEventListener('change', function (e) {
  var el = e.target;
  if (!ales || !el.dataset.camp) return;
  var v = Number(el.value);
  if (!isFinite(v) || v < 0) return;
  ales[el.dataset.camp] = v;
  pune(ales); coloreaza(); arataPanou(); salveaza(ales);
});

/* ---------- salvarea ---------- */

var amanat = null;
function salveazaAmanat(c) { clearTimeout(amanat); amanat = setTimeout(function () { salveaza(c); }, 500); }

function anunta(text, rau) {
  stare.hidden = !text;
  stare.textContent = text || '';
  stare.classList.toggle('rau', !!rau);
}

var reincarcare = null;
function salveaza(c) {
  /* pe pagina publică e doar o încercare: nu se salvează nimic */
  if (DATE.demo) return;
  anunta(TX.seSalveaza);
  fetch('/api/corps/' + c.id + '/pozitie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': CSRF },
    body: JSON.stringify({ perete: c.perete, d: Math.round(c.d * 10) / 10, h: Math.round(c.h * 10) / 10 })
  }).then(function (r) {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }).then(function () {
    anunta(TX.salvat);
    setTimeout(function () { if (stare.textContent === TX.salvat) anunta(''); }, 1500);
    clearTimeout(reincarcare);
    reincarcare = setTimeout(reincarcaPagina, 400);
  }).catch(function () {
    anunta(TX.eroare, true);
  });
}

/* Planul, problemele, elevațiile și tabelul de dedesubt vin de la server:
   după o mutare se iau din nou, fără să se piardă unghiul din care privești. */
function reincarcaPagina() {
  fetch(location.pathname, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    ['anProbleme', 'anSus', 'anElevatii', 'anPozitii'].forEach(function (id) {
      var nou = doc.getElementById(id), vechi = document.getElementById(id);
      if (nou && vechi) vechi.innerHTML = nou.innerHTML;
    });
  }).catch(function () { /* rămâne pagina de dinainte */ });
}

/* ---------- camera din pagina publică ----------
   Pe pagina de demonstrație dimensiunile camerei se schimbă pe loc: se
   redesenează pereții, corpurile rămân unde erau și se înroșesc dacă nu mai
   încap. Nu se salvează nimic. */
var formCamera = document.getElementById('demoCamera');
if (formCamera && DATE.demo) {
  formCamera.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.cam;
    var v = Number(e.target.value);
    if (!k || !isFinite(v)) return;
    var min = Number(e.target.min) || 0, max = Number(e.target.max) || 20000;
    v = Math.max(min, Math.min(max, v));
    e.target.value = v;
    CAM[k] = v;
    deseneazaPereti(CAM);
    CORPURI.forEach(pune);
    coloreaza();
    arataPanou();
    T.target.set(CAM.A / 2, CAM.H * 0.3, CAM.B / 2);
    T.r = Math.max(CAM.A, CAM.B, CAM.H) * 1.9;
  });
}

/* ---------- vederi, pereți, buclă ---------- */

document.querySelectorAll('[data-vedere]').forEach(function (b) {
  b.onclick = function () {
    var v = { iso: [0.85, 1.15], fata: [0, Math.PI / 2 - 0.05], sus: [0, 0.12] }[b.dataset.vedere];
    T.theta = v[0]; T.phi = v[1];
  };
});

var chPereti = document.getElementById('anPereti');
if (chPereti) chPereti.onchange = function () { grupPereti.visible = chPereti.checked; };

(function bucla() {
  requestAnimationFrame(bucla);
  var t = T.target;
  camera.position.set(
    t.x + T.r * Math.sin(T.phi) * Math.sin(T.theta),
    t.y + T.r * Math.cos(T.phi),
    t.z + T.r * Math.sin(T.phi) * Math.cos(T.theta)
  );
  camera.lookAt(t);
  /* Ca în planificatoarele magazinelor: zidul dintre tine și cameră dispare,
     ca să vezi înăuntru. */
  pereti.forEach(function (p) {
    var vx = camera.position.x - p.x, vz = camera.position.z - p.z;
    p.mesh.visible = (vx * p.n[0] + vz * p.n[1]) > 0 || T.phi < 0.3;
  });
  renderer.render(scene, camera);
})();

info.innerHTML = '<span class="muted">' + scapa(TX.seIncarca) + '</span>';

/* Limba paginii merge mai departe la API: numele pieselor vin traduse. */
(DATE.demo ? Promise.resolve(DATE.demo) :
 fetch('/api/orders/' + DATE.orderId + '/ansamblu?lang=' +
       encodeURIComponent(document.documentElement.lang || ''))
  .then(function (r) { return r.json(); }))
  .then(function (date) {
    construieste(date);
    resize();
    arataPanou();
  })
  .catch(function () {
    info.innerHTML = '<span class="muted">' + scapa(TX.nuSeIncarca) + '</span>';
  });
})();
