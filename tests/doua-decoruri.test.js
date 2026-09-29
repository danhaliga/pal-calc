'use strict';
/* Două decoruri de la deschiderea comenzii: unul de carcase, unul de fronturi.

   Până acum se alegea unul singur, iar al doilea se adăuga pe urmă, în
   comandă. Dar decorul fronturilor se știe de la început — e prima întrebare
   pe care o pune clientul — și n-are rost să te trimită aplicația în altă
   parte pentru el. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalRaport = require('../shared/raport');
const PalI18n = require('../shared/i18n');
const materiale = require('../src/materiale');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

const mat = (id, rol, decor, gros) => ({
  id, rol, brand: 'Egger', decor_cod: decor, decor_nume: decor,
  pal_mm: gros || 18, cant_gros: 2, cant_subtire: 0.8
});
const STEJAR = mat(1, 'corp', 'H1113');
const ALB = mat(2, 'front', 'W1000');
const IEFTIN = mat(3, 'sertar', 'U999', 16);

/* ---------------- cine din ce se taie ---------------- */

test('un singur material: totul iese din el', () => {
  const r = materiale.peRoluri([STEJAR]);
  assert.equal(r.corp.id, 1);
  assert.equal(r.front.id, 1, 'fronturile ar trebui să cadă pe carcasă');
  assert.equal(r.sertar.id, 1, 'cutiile ar trebui să cadă pe carcasă');
});

test('două materiale: fronturile ale lor, cutiile tot ale carcasei', () => {
  /* Cutia de sertar e treabă de carcasă — se face din PAL, în atelier, și nu
     se vede. Fără un rând al ei, cade pe carcasă, și bine face. */
  const r = materiale.peRoluri([STEJAR, ALB]);
  assert.equal(r.corp.id, 1);
  assert.equal(r.front.id, 2);
  assert.equal(r.sertar.id, 1, 'cutiile au plecat pe decorul fronturilor de capul lor');
});

test('cutiile din alt decor cer un rând al lor', () => {
  /* Un rând are UN rol, iar `peRoluri` caută rândul de sertare — nu se uită
     la cel de fronturi. De-aia, când omul cere cutiile din decorul
     fronturilor, se scrie un rând de sertare cu decorul ăla. */
  const r = materiale.peRoluri([STEJAR, ALB, IEFTIN]);
  assert.equal(r.sertar.id, 3);
  assert.equal(r.corp.id, 1, 's-a mișcat carcasa');
  assert.equal(r.front.id, 2, 's-au mișcat fronturile');
});

test('piesele ajung pe materialul potrivit', () => {
  /* Un corp care are din fiecare: laterală și poliță de carcasă, ușă și front
     de sertar, cutie de sertar. */
  const params = Object.assign(PalModels.paramsFor('baza-4sertare', T),
                               { nSer: 2, nUsi: 1, nPol: 1, hUsi: 300 });
  const res = PalCalc.calc(params, T);
  const pe = { corp: STEJAR, front: ALB, sertar: IEFTIN };
  const decorul = cheie => {
    const p = res.P.filter(x => x.cheie === cheie)[0];
    assert.ok(p, 'lipsește piesa ' + cheie);
    return PalRaport.materialPiesa(p, params, pe, T).decor;
  };
  assert.equal(decorul('laterala'), 'H1113', 'laterala nu e din decorul carcasei');
  assert.equal(decorul('polita'), 'H1113');
  assert.equal(decorul('usa'), 'W1000', 'ușa nu e din decorul fronturilor');
  assert.equal(decorul('frontSertar'), 'W1000', 'frontul de sertar nu e front');
  assert.equal(decorul('sertarLaterala'), 'U999', 'cutia nu e din decorul ei');
});

test('două rânduri cu același decor nu dublează plăcile de cumpărat', () => {
  /* Când cutiile se cer din decorul fronturilor ies DOUĂ rânduri cu aceeași
     placă. La cumpărat trebuie să rămână una: croirea grupează după placă,
     nu după rândul din comandă. */
  const acelasi = Object.assign({}, ALB, { id: 3, rol: 'sertar' });
  const params = PalModels.paramsFor('baza-4sertare', T);
  const res = PalCalc.calc(params, T);
  const pe = { corp: STEJAR, front: ALB, sertar: acelasi };
  const chei = res.P
    .filter(p => p.rol === 'front' || p.rol === 'sertar')
    .map(p => PalRaport.materialPiesa(p, params, pe, T).key);
  assert.equal(new Set(chei).size, 1,
    'fronturile și cutiile din aceeași placă ies ca două plăci: ' + JSON.stringify(chei));
});

/* ---------------- formularul ---------------- */

test('selectorul de decor își poate primi numele câmpului', () => {
  /* Două câmpuri cu același nume ar trimite două valori sub aceeași cheie, iar
     a doua ar călca peste prima în tăcere. */
  const partial = citeste('views', 'partials', 'decor-picker.ejs');
  assert.match(partial, /name="<%= p\.camp \|\| 'decor_cod' %>"/,
    'numele câmpului e bătut în cuie, deci doi selectori pe pagină se calcă');
});

test('comanda nouă are amândouă materialele, cu câmpuri diferite', () => {
  const v = citeste('views', 'orders', 'new.ejs');
  assert.equal((v.match(/decor-picker/g) || []).length, 2, 'nu sunt doi selectori de decor');
  assert.match(v, /camp: 'decor_cod'/);
  assert.match(v, /camp: 'decor_cod_front'/);
  ['brand_front', 'pal_mm_front', 'cant_gros_front', 'cant_subtire_front'].forEach(c => {
    assert.ok(v.indexOf('name="' + c + '"') !== -1, 'lipsește câmpul ' + c);
  });
  assert.match(v, /name="sertare_din"/, 'lipsește întrebarea cu cutiile de sertar');
  assert.match(v, /legMaterialCarcase[\s\S]*legMaterialFronturi/,
    'carcasele trebuie să vină înaintea fronturilor');
});

test('blocul de fronturi se deschide din bifă, fără JavaScript', () => {
  /* Bifa stă ÎN AFARA etichetei și ÎNAINTEA blocului, ca s-o poată ajunge `~`.
     Mutată înăuntru, selectorul nu mai prinde și blocul rămâne veșnic
     deschis — cinci casete care nu fac nimic la o comandă dintr-un decor. */
  const v = citeste('views', 'orders', 'new.ejs');
  const bifa = v.indexOf('id="front_alt"');
  const bloc = v.indexOf('class="doar-daca"');
  assert.ok(bifa !== -1 && bloc !== -1, 'lipsește bifa sau blocul');
  assert.ok(bifa < bloc, 'bifa a ajuns după bloc: `~` nu mai are ce ajunge');
  assert.ok(v.slice(bifa, bloc).indexOf('</label>') === -1 ||
            /class="comutator"/.test(v.slice(Math.max(0, bifa - 200), bifa + 200)),
            'bifa nu mai e comutatorul de afară');

  const css = citeste('public', 'styles.css');
  assert.match(css, /\.comutator:not\(:checked\) ~ \.doar-daca\{display:none\}/,
    'fără regula asta blocul e mereu vizibil');
});

test('cantul stă în fișa materialului, nu singur între ele', () => {
  /* Un material E decor + grosime + cant. Cu două materiale pe pagină, o
     casetă de cant plutind între ele n-ar mai spune al cui e. */
  const v = citeste('views', 'orders', 'new.ejs');
  const carcase = v.indexOf('legMaterialCarcase');
  const fronturi = v.indexOf('legMaterialFronturi');
  const cantCarcase = v.indexOf('name="cant_gros"');
  assert.ok(cantCarcase > carcase && cantCarcase < fronturi,
    'cantul carcasei a ieșit din fieldsetul ei');
  assert.ok(v.indexOf('name="cant_gros_front"') > fronturi,
    'cantul fronturilor nu e în fieldsetul lor');
});

/* ---------------- ruta ---------------- */

test('ruta scrie al doilea material, și al treilea numai când se cere', () => {
  const s = citeste('src', 'orders.js');
  assert.match(s, /function materialFronturi/, 'lipsește citirea materialului de fronturi');
  assert.match(s, /rol: 'front'/, 'nu se scrie rândul de fronturi');
  assert.match(s, /d\.sertare_din === 'front'[\s\S]{0,200}rol: 'sertar'/,
    'rândul de sertare nu atârnă de alegerea omului');
  assert.match(s, /if \(!cerut \|\| !d\.decor_cod_front\) return null/,
    'o bifă fără decor ales ar lăsa un rând gol în comandă');
});

test('câmpurile noi nu pot strica o comandă bună', () => {
  /* Casetele fronturilor sunt ascunse până se bifează. Un formular trimis
     fără ele e cazul OBIȘNUIT, nu o greșeală: o comandă întreagă nu se pierde
     fiindcă lipsește un câmp pe care omul nici nu l-a văzut. */
  const s = citeste('src', 'orders.js');
  [/pal_mm_front: z\.coerce\.number\(\)\.catch\(0\)/,
   /cant_gros_front:[^\n]*\.catch\(0\)/,
   /cant_subtire_front:[^\n]*\.catch\(0\)/,
   /sertare_din: z\.enum\(\['corp', 'front'\]\)\.catch\('corp'\)/].forEach(re => {
    assert.match(s, re, 'un câmp nou n-are plasă: ' + re);
  });
});

/* ---------------- limbile ---------------- */

test('cele șapte chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['comandaNoua.legMaterialCarcase', 'comandaNoua.legMaterialFronturi',
                'comandaNoua.frontAltDecor', 'comandaNoua.notaFrontAcelasi',
                'comandaNoua.cutiiDinCarcasa', 'comandaNoua.cutiiDinFronturi',
                'comandaNoua.intro',
                /* eticheta cutiilor nu e nouă: e `rol.sertar`, tradusă demult */
                'rol.sertar'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = v => (String(v).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  const ro = JSON.parse(citeste('locales', 'ro.json'));

  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipsește ' + k);
      assert.equal(param(v), param(ia(ro, k)), l.cod + ': parametri schimbați la ' + k);
    });
  });
});

test('îndrumarea de sus nu mai trimite omul în altă parte după fronturi', () => {
  /* Textul de până acum spunea că materialul de fronturi se adaugă „în
     comandă", adică mai târziu. Acum se alege chiar acolo, iar o îndrumare
     care trimite aiurea e mai rea decât niciuna. */
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  assert.match(ro.comandaNoua.intro, /fronturi/i);
  assert.ok(!/poți adăuga oricâte altele în comandă \(fronturi/.test(ro.comandaNoua.intro),
    'a rămas textul vechi');
});
