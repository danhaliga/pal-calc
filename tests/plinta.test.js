'use strict';
/* Plinta aplicată și picioarele.

   Corpurile de bucătărie puse în șir stau pe picioare de plastic, cu o
   plintă de aluminiu cumpărată, clipsată în față. Nu se taie nimic: totul
   intră la feronerie. Un corp singur pe podea se face cu soclu din PAL —
   ăla e în calc.js și rămâne cum era. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { raport, lungimePlinta } = require('../shared/raport');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalI18n = require('../shared/i18n');
const Fero = require('../shared/feronerie');

const T = k => k;
const OPT = { effortMs: 0, adaosCant: 15, t: T };
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

const mat = { id: 1, nume: 'PAL', rol: 'corp', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 };
const comanda = plinta => ({ id: 1, name: 'Bucătărie', formate: ['intreaga'], materiale: [mat],
                             feronerie: JSON.stringify({ plinta: plinta }) });
let nr = 0;
const dinModel = (id, extra) => {
  nr++;
  return { id: nr, name: id, poz: nr, params: Object.assign(PalModels.paramsFor(id, T), extra || {}),
           materiale: { corp: mat, front: mat, sertar: mat } };
};
const rand = (r, cheie) => r.feronerie.filter(f => f.nume.indexOf(cheie) === 0);

/* ---------------- cine stă pe picioare ---------------- */

test('corpurile de jos din catalog vin pe picioare; cele suspendate și cele pe soclu nu', () => {
  assert.equal(+PalModels.paramsFor('baza-2usi', T).picioare, 1);
  assert.equal(+PalModels.paramsFor('colt-jos-L', T).picioare, 1);
  assert.ok(!+PalModels.paramsFor('sus-2usi', T).picioare, 'un corp suspendat pe picioare');
  assert.ok(!+PalModels.paramsFor('colt-sus-L', T).picioare);
  assert.ok(!+PalModels.paramsFor('baza-2usi-soclu', T).picioare, 'soclul și picioarele deodată');
  /* Numai bucătăria: la living și baie nu s-a spus așa. */
  assert.ok(!+PalModels.paramsFor('dulap-2usi', T).picioare);
  assert.ok(!+PalModels.paramsFor('vitrina', T).picioare);
  assert.ok(!+PalModels.paramsFor('colt-dressing', T).picioare);
});

test('picioarele nu schimbă nicio piesă de tăiat', () => {
  const cu = PalCalc.calc(PalModels.paramsFor('baza-2usi', T), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const fara = PalCalc.calc(Object.assign(PalModels.paramsFor('baza-2usi', T), { picioare: 0 }), T)
    .P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(cu, fara);
});

test('lungimea de plintă a unui corp urmează linia fronturilor', () => {
  const lung = (id, extra) => {
    const p = Object.assign(PalModels.paramsFor(id, T), extra || {});
    return lungimePlinta(p, PalCalc.calc(p, T));
  };
  assert.equal(lung('baza-2usi'), 800);
  const L = PalCalc.calc(PalModels.paramsFor('colt-jos-L', T), T).colt;
  assert.equal(lung('colt-jos-L'), L.brA + L.brB);
  const dg = PalCalc.calc(PalModels.paramsFor('colt-jos-diagonal', T), T).colt;
  assert.equal(lung('colt-jos-diagonal'), dg.diag);
  /* La colțul orb, partea oarbă stă sub corpul vecin, care are plinta lui. */
  const orb = PalModels.paramsFor('colt-jos-orb', T);
  assert.equal(lung('colt-jos-orb'), orb.W - orb.orb);
  assert.equal(lung('sus-2usi'), 0);
  assert.equal(lung('baza-2usi', { soclu: 80, H: 800 }), 0, 'cu soclu nu mai trebuie plintă');
});

/* ---------------- ce intră în lista de feronerie ---------------- */

test('plinta se adună pe toată comanda și se cumpără în bare întregi', () => {
  const corpuri = [dinModel('baza-2usi'), dinModel('baza-2sertare'), dinModel('baza-1usa'),
                   dinModel('baza-2usi'), dinModel('baza-chiuveta'), dinModel('baza-2usi'),
                   dinModel('sus-2usi')];
  const r = raport(comanda('alu-100'), corpuri, OPT);
  const bara = rand(r, 'fero.art.plintaBara');
  assert.equal(bara.length, 1, 'plinta trebuie să fie un singur rând pe comandă');
  /* 800+600+400+800+800+800 = 4200 → două bare de 4000 */
  assert.equal(bara[0].qty, 2);
});

test('picioare: 4 pe corp, la orice lățime (Dan); clemă pe fiecare picior din față', () => {
  const r = raport(comanda('alu-120'), [dinModel('baza-2usi'), dinModel('baza-2usi', { W: 1200 })], OPT);
  /* picioarele au acum tipul lor din catalogul Häfele (implicit AXILO 78, H 100) */
  const pic = rand(r, 'fero.art.piciorTip');
  assert.equal(pic.length, 1);
  assert.equal(pic[0].qty, 4 + 4);
  assert.equal(r.corpuri[0].res.picior.cod, '637.76.353');
  assert.equal(rand(r, 'fero.art.suportPicior')[0].qty, 4 + 4, 'un suport la fiecare picior AXILO');
  assert.equal(rand(r, 'fero.art.clemaPlintaCod')[0].qty, 2 + 2);
});

test('fără plintă, picioarele tot se cumpără, dar nu și bara sau clemele', () => {
  const r = raport(comanda('fara'), [dinModel('baza-2usi')], OPT);
  assert.equal(rand(r, 'fero.art.plintaBara').length, 0);
  assert.equal(rand(r, 'fero.art.clemaPlintaCod').length, 0);
  assert.equal(rand(r, 'fero.art.piciorTip')[0].qty, 4);
});

test('un corp pe soclu sau suspendat nu cere nici picioare, nici plintă', () => {
  const r = raport(comanda('alu-100'), [dinModel('baza-2usi-soclu'), dinModel('sus-2usi')], OPT);
  assert.equal(rand(r, 'fero.art.picior').length, 0);
  assert.equal(rand(r, 'fero.art.plintaBara').length, 0);
});

test('comenzile vechi, fără alegere de plintă, primesc H100', () => {
  assert.equal(Fero.citeste(null).plinta, 'alu-100');
  assert.equal(Fero.citeste('{"balama":"universal"}').plinta, 'alu-100');
  assert.equal(Fero.citeste({ plinta: 'aiurea' }).plinta, 'alu-100');
  assert.equal(Fero.citeste({ plinta: 'alu-150' }).plinta, 'alu-150');
  assert.equal(Fero.sistem({ plinta: 'alu-150' }).plinta.h, 150);
});

/* ---------------- formularul și editorul ---------------- */

test('plinta se alege în formularul de feronerie și ajunge la server', () => {
  assert.match(citeste('views', 'partials', 'feronerie-form.ejs'), /'plinta',\s+'fero\.intrebarePlinta'/);
  const o = citeste('src', 'orders.js');
  assert.match(o, /plinta: body\.plinta/);
  assert.match(o, /plinta: z\.string\(\)/);
});

test('editorul are alegerea „pe picioare" și o trimite la calcul', () => {
  assert.match(citeste('views', 'corps', 'edit.ejs'), /id="picioare"/);
  assert.match(citeste('public', 'app.js'), /var fields = \[[^\]]*'picioare'/);
  const schema = PalCalc.schema && PalCalc.schema();
  if (schema) {
    assert.equal(schema.parse(Object.assign(PalCalc.defaults(), { picioare: 1 })).picioare, 1);
    assert.equal(schema.parse(Object.assign(PalCalc.defaults(), { picioare: 'da' })).picioare, 0);
  }
});

test('textele plintei și ale picioarelor există în toate limbile, cu aceiași parametri', () => {
  const chei = ['editor.picioare', 'editor.picioareNu', 'editor.picioareDa', 'fero.intrebarePlinta',
    'fero.plinta.alu-100.nume', 'fero.plinta.alu-120.nume', 'fero.plinta.alu-150.nume',
    'fero.plinta.fara.nume', 'fero.plinta.fara.descriere',
    'fero.art.piciorPlinta', 'fero.art.picior', 'fero.art.obsPicioare', 'fero.art.clemaPlinta',
    'fero.art.obsClemaPlinta', 'fero.art.plintaBara', 'fero.art.obsPlinta'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
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

test('picioarele Häfele: înălțimea totală, textul din listă și plinta potrivită', () => {
  const t = require('../shared/i18n').creeaza('ro');
  const p = PalModels.paramsFor('baza-2usi', t);
  const r = PalCalc.calc(Object.assign({}, p, { picior: 'axilo78-150' }), t);
  assert.equal(r.picior.h, 150);
  assert.equal(r.inaltimeTotala, 720 + 150);
  assert.equal(r.picioare3d.length, 4);
  assert.ok(r.picioare3d.every(b => b.y === -150 && b.sy === 150), 'picioarele stau sub corp');
  /* cu soclu, fără picioare */
  const s = PalCalc.calc(Object.assign({}, p, { soclu: 100 }), t);
  assert.equal(s.picior, null);
  assert.equal(s.inaltimeTotala, 720);
  /* în listă: „H 720 + picioare 150 = 870" */
  const R = raport({ id: 1, name: 'x', formate: ['intreaga'], materiale: [mat], feronerie: JSON.stringify({ plinta: 'alu-100' }) },
    [{ id: 1, name: 'c', poz: 1, params: Object.assign({}, p, { picior: 'axilo78-150' }), materiale: { corp: mat, front: mat, sertar: mat } }],
    { effortMs: 0, adaosCant: 15, t });
  assert.match(R.corpuri[0].dimensiuni, /H 720 \+ picioare 150 = 870/);
  /* plinta de 100 nu intră în reglajul 140–170 */
  assert.ok(R.corpuri[0].avertismente.some(w => /Plinta de 100 mm/.test(w)));
});
