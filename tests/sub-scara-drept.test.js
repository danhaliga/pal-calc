'use strict';
/* Corpul de sub scară cu îmbinări drepte — cum lucrează Dan.

   Baza pe toată lungimea, lateralele stau pe ea, tavanul (panta) între
   laterale, cu capetele tăiate vertical. Prindere cu eurosurub. Sus,
   lateralele se taie drept (treaptă mică spre scară, ascunsă) sau înclinat,
   la nivel cu panta. Fiecare corp are laterala lui. */

const test = require('node:test');
const assert = require('node:assert/strict');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalFisa = require('../shared/fisa-piesa');
const PalI18n = require('../shared/i18n');
const PalRaport = require('../shared/raport');

const T = k => k;
const ro = PalI18n.creeaza('ro');
const corp = extra => Object.assign(PalCalc.defaults(T),
  { tip: 'atipic', contur: PalCalc.conturSubScara(900, 400, 800), t: 18, D: 560,
    nUsi: 0, nPol: 0, jp: 1 }, extra || {});
const piese = r => r.P.map(p => p.cheie);
const ALFA = Math.atan2(400, 900);                          /* panta, 23.96° */

test('implicit la forma de sub scară: bază, două laterale, tavan — fără panouri în unghi', () => {
  const r = PalCalc.calc(corp(), T);
  assert.deepEqual(r.warn, []);
  assert.deepEqual(piese(r).filter(k => k !== 'spateAtipic'), ['fund', 'laterala', 'laterala', 'tavanPanta']);
});

test('baza e pe toată lungimea, lateralele stau pe ea', () => {
  const r = PalCalc.calc(corp(), T);
  assert.equal(r.P.find(p => p.cheie === 'fund').L, 900);
  const [st, dr] = r.P.filter(p => p.cheie === 'laterala');
  /* drept sus, la fața cea mai joasă: stânga 800 − 18·tan(pantă) − 18 */
  assert.ok(Math.abs(st.L - (800 - 18 * Math.tan(ALFA) - 18)) < 0.1, 'stânga ' + st.L);
  assert.equal(dr.L, 400 - 18);
});

test('lateralele înclinate sus: fața înaltă și cea joasă, la unghiul pantei', () => {
  const [st, dr] = PalCalc.calc(corp({ capatLaterala: 'inclinat' }), T).P.filter(p => p.cheie === 'laterala');
  assert.equal(st.L, 800 - 18);
  assert.equal(dr.L, 400 + Math.round(18 * Math.tan(ALFA) * 10) / 10 - 18);
  assert.equal(st.notaCheie, 'lateralaSusInclinata');
});

test('tavanul stă între laterale: capete verticale, aceeași lungime pe ambele fețe', () => {
  const tv = PalCalc.calc(corp(), T).P.find(p => p.cheie === 'tavanPanta');
  assert.ok(Math.abs(tv.L - (900 - 36) / Math.cos(ALFA)) < 0.1, 'tavan ' + tv.L);
  const f = PalFisa.fise(corp(), ro).find(x => x.cheie === 'tavanPanta');
  assert.equal(f.fel, 'tavan');
  assert.match(f.randuri.join(' '), /66\.04° față de fața de sus — la fierăstrău pânza la 23\.96°/);
});

test('golul dinăuntru e același ca la rama în unghi: polița și montantul nu se schimbă', () => {
  const a = PalCalc.calc(corp({ nDsp: 1, nPol: 1 }), T).P.filter(p => /polita|montant/.test(p.cheie));
  const b = PalCalc.calc(corp({ nDsp: 1, nPol: 1, imbinare: 'unghi' }), T).P.filter(p => /polita|montant/.test(p.cheie));
  assert.deepEqual(a.map(p => [p.cheie, p.buc, p.L, p.l]), b.map(p => [p.cheie, p.buc, p.L, p.l]));
});

test('la „explodat" baza coboară, lateralele ies în lături, tavanul urcă', () => {
  const r = PalCalc.calc(corp(), T);
  const ex = k => r.P.filter(p => p.cheie === k).map(p => p.boxes[0].ex);
  assert.ok(ex('fund')[0][1] < 0);
  assert.ok(ex('laterala')[0][0] < 0 && ex('laterala')[1][0] > 0);
  assert.ok(ex('tavanPanta')[0][1] > 0);
});

test('lista CNC: tavanul și lateralele înclinate la „tăiere la unghi", fără frezare de contur', () => {
  const r = PalRaport.raport({ id: 1, name: 'p', materiale: [], formate: ['intreaga'], feronerie: null },
    [{ id: 1, name: 'c', poz: 1, params: corp({ capatLaterala: 'inclinat' }), materiale: {} }], { t: T, effortMs: 0 });
  const cnc = r.cnc.map(x => x.piesa);
  assert.ok(cnc.some(n => /tavanPanta/.test(n)), 'tavanul lipsește din CNC');
  assert.equal(r.cnc.filter(x => /laterala|tavanPanta/.test(x.piesa) && x.poly).length, 0,
    'o secțiune a fost luată drept contur de decupat');
});

test('rama în unghi se poate alege; la alte forme atipice rămâne în unghi', () => {
  assert.ok(piese(PalCalc.calc(corp({ imbinare: 'unghi' }), T)).includes('panouLatura'));
  const m = PalModels.paramsFor('atipic-mansarda', T);
  assert.ok(piese(PalCalc.calc(m, T)).includes('panouLatura'));
  const cerut = PalCalc.calc(Object.assign({}, m, { imbinare: 'drept' }), T);
  assert.ok(cerut.avertismente.some(a => a.cheie === 'imbinareDreaptaNuMerge'));
});

test('polițele se împart pe toată înălțimea; cele de sub pantă se scurtează, cu capătul înclinat', () => {
  const p = corp({ contur: PalCalc.conturSubScara(1000, 600, 1200), nPol: 3 });
  const pol = PalCalc.calc(p, T).P.filter(x => x.cheie === 'polita');
  const intregi = pol.filter(x => !x.notaCheie), panta = pol.filter(x => x.notaCheie === 'politaSubPanta');
  assert.equal(intregi.reduce((s, x) => s + x.buc, 0), 2);
  assert.equal(panta.length, 1);
  const alfa = Math.atan2(600, 1000);
  /* fața de sus e mai scurtă cu t / tan(pantă) */
  assert.ok(Math.abs(panta[0].L - +panta[0].notaArgs.sus - 18 / Math.tan(alfa)) < 0.2);
  assert.ok(panta[0].L < intregi[0].L, 'polița de sub pantă nu e mai scurtă decât golul');
  const f = PalFisa.fise(p, ro).find(x => x.fel === 'politaPanta');
  assert.ok(f, 'polița de sub pantă n-are fișă');
  assert.match(f.randuri.join(' '), /30\.96° față de fața de jos — la fierăstrău pânza la 59\.04°/);
});
