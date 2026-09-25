'use strict';
/* Raportul unei comenzi: piese, cant, plăci, feronerie, CNC. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { raport, feronerie, materialPiesa, muchiiFrontale, planseCnc } = require('../shared/raport');
const { calc, defaults } = require('../shared/calc');

const comanda = (over) => Object.assign({
  id: 1, name: 'Bucătărie test', brand: 'egger', decor: 'W980 Alb',
  cant_decor: 'Alb', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4, adaos_cant: 15
}, over);

const corp = (nume, over, poz) => ({
  id: poz || 1, name: nume, poz: poz || 1,
  params: Object.assign(defaults(), { nume }, over)
});

const OPT = { effortMs: 0 };   /* fără restarturi randomizate: teste rapide și stabile */

/* ---------------- piese și materiale ---------------- */

test('un corp de bază: piese, materiale și bucăți', () => {
  const r = raport(comanda(), [corp('Corp bază', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);

  assert.equal(r.totaluri.corpuri, 1);
  assert.equal(r.totaluri.randuri, 6);              // laterală, blat, fund, spate, ușă, poliță
  assert.equal(r.totaluri.bucati, 8);               // 2+1+1+1+2+1

  const chei = r.materiale.map(m => m.key).sort();
  assert.deepEqual(chei, ['pal18', 'pfl3']);
  assert.equal(r.materiale.find(m => m.key === 'pal18').placi, 1);
  assert.equal(r.materiale.find(m => m.key === 'pfl3').placi, 1);
});

test('materialul se deduce din numele piesei', () => {
  const c = Object.assign(defaults(), { t: 18, tp: 3, ts: 16 });
  assert.equal(materialPiesa({ nume: 'Laterală' }, c).key, 'pal18');
  assert.equal(materialPiesa({ nume: 'Spate PFL aplicat' }, c).key, 'pfl3');
  assert.equal(materialPiesa({ nume: 'Sertar – laterală cutie' }, c).key, 'pal16');
  assert.equal(materialPiesa({ nume: 'Sertar – fund PFL' }, c).key, 'pfl3');
  assert.equal(materialPiesa({ nume: 'Spate PAL aplicat' }, Object.assign({}, c, { tp: 18 })).key, 'pal18');
});

/* ---------------- cant ---------------- */

test('metrii de cant, pe grosimi, cu adaosul cerut', () => {
  const r = raport(comanda(), [corp('Corp bază', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);

  const gros = r.cant.linii.find(x => x.mm === 2);
  const subtire = r.cant.linii.find(x => x.mm === 0.4);

  // 2 mm: laterale 2×0.72 + blat 0.764 + fund 0.764 + uși 2×(2×0.717+2×0.397) + poliță 0.763
  assert.equal(gros.ml, 8.19);
  // 0.4 mm: laterale, câte două muchii scurte de 557
  assert.equal(subtire.ml, 2.23);

  assert.equal(r.cant.adaosPct, 15);
  assert.equal(gros.cuAdaos, 9.42);                 // 8.187 × 1.15
  assert.equal(subtire.cuAdaos, 2.56);
});

test('adaosul la cant nu poate coborî sub 10%', () => {
  const r = raport(comanda({ adaos_cant: 2 }), [corp('Corp', { nUsi: 1, nPol: 0 })], OPT);
  assert.equal(r.cant.adaosPct, 10);
});

test('cantul unei piese arată grosimea pe fiecare muchie', () => {
  const r = raport(comanda(), [corp('Corp', { nUsi: 0, nPol: 0 })], OPT);
  const lat = r.piese.find(p => p.nume === 'Laterală');
  assert.deepEqual(lat.cant.muchii, ['2', '–', '0.4', '0.4']);
});

/* ---------------- feronerie ---------------- */

test('feroneria unui corp cu două uși și o poliță', () => {
  const params = Object.assign(defaults(), { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 });
  const items = feronerie(params, calc(params));
  const get = n => (items.find(x => new RegExp(n).test(x.nume)) || {}).qty;

  assert.equal(get('^Balama cupă'), 4);             // 2 uși × 2 balamale
  assert.equal(get('Euroșurub'), 16);
  assert.equal(get('Suport poliță'), 4);
  assert.equal(get('Confirmat'), 12);
  assert.equal(get('Diblu'), 8);
  assert.equal(get('^Mâner$'), 2);
  assert.equal(get('Holșurub'), 21);                // perimetru 3040 mm / 150
  assert.equal(get('glisiere'), undefined);
});

test('feroneria unui corp cu sertare include glisierele', () => {
  const params = Object.assign(defaults(), { nUsi: 0, nPol: 0, nSer: 3, hFront: 237, hCutie: 180 });
  const items = feronerie(params, calc(params));
  const glis = items.find(x => /glisiere/.test(x.nume));
  assert.ok(glis, 'lipsesc glisierele');
  assert.equal(glis.qty, 3);
  assert.match(glis.nume, /500 mm/);                // adâncime interioară 557 → glisieră 500
});

test('corpul în L primește balama-carte', () => {
  const params = Object.assign(defaults(), { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 2, nPol: 0 });
  const items = feronerie(params, calc(params));
  assert.ok(items.some(x => /Balama-carte/.test(x.nume)));
});

/* ---------------- CNC ---------------- */

test('corpul în L trimite blatul și fundul la CNC, cu decupajul cotat', () => {
  const r = raport(comanda(), [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 2, nPol: 0 })], OPT);

  assert.equal(r.cnc.length, 2);                    // blat + fund
  const blat = r.cnc.find(x => x.piesa === 'Blat');
  assert.equal(blat.tip, 'Decupaj colț interior');
  assert.match(blat.detalii, /decupaj 322 × 322 mm din colț/);
  assert.match(blat.detalii, /muchii cantuite 322 \+ 322 mm/);
  assert.equal(blat.gabarit.L, 882);
});

test('colțul diagonal cere tăiere la 45°', () => {
  const r = raport(comanda(), [corp('Colț', { tip: 'colt-diagonal', W: 900, W2: 900, D: 560, nUsi: 1, nPol: 0 })], OPT);
  const blat = r.cnc.find(x => x.piesa === 'Blat');
  assert.equal(blat.tip, 'Tăiere la 45°');
  assert.match(blat.detalii, /muchie diagonală 455\.4 mm/);
});

test('nutul pentru spate intră în lista de prelucrări', () => {
  const r = raport(comanda(), [corp('Corp', { spate: 'nut', nUsi: 0, nPol: 0 })], OPT);
  const nuturi = r.cnc.filter(x => x.tip === 'Nut pentru spate');
  assert.equal(nuturi.length, 3);                   // laterală, blat, fund
  assert.match(nuturi[0].detalii, /adâncime 8 mm, la 10 mm/);
});

test('corpul drept cu spate aplicat nu are prelucrări CNC', () => {
  const r = raport(comanda(), [corp('Corp', { nUsi: 2, nPol: 1 })], OPT);
  assert.equal(r.cnc.length, 0);
});

test('cantul panourilor de colț se pune pe muchiile frontale', () => {
  const r = raport(comanda(), [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 0, nPol: 0 })], OPT);
  const blat = r.piese.find(p => p.nume === 'Blat');
  assert.equal(blat.cant.special, true);
  assert.equal(blat.cant.ml, 0.64);                 // (322 + 322) mm
});

test('muchiile frontale sunt doar cele care nu stau pe gabarit', () => {
  const L = [[0, 0], [882, 0], [882, 560], [560, 560], [560, 882], [0, 882]];
  assert.equal(muchiiFrontale(L).length, 2);
  const pentagon = [[0, 0], [882, 0], [882, 560], [560, 882], [0, 882]];
  assert.equal(muchiiFrontale(pentagon).length, 1);
});

test('planșa CNC este un SVG cu piesa și gabaritul', () => {
  const r = raport(comanda(), [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 2, nPol: 0 })], OPT);
  const svg = planseCnc(r.cnc[0]);
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('cnc-gabarit'), 'lipsește dreptunghiul de gabarit');
  assert.ok(svg.includes('cnc-piesa'), 'lipsește conturul piesei');
  assert.equal((svg.match(/class="cnc-cant"/g) || []).length, 2);
});

/* ---------------- comandă cu mai multe corpuri ---------------- */

test('comandă cu trei corpuri: totaluri și coduri de piesă', () => {
  const r = raport(comanda(), [
    corp('Corp bază', { W: 800, nUsi: 2, nPol: 1 }, 1),
    corp('Corp suspendat', { W: 600, H: 720, D: 320, nUsi: 1, nPol: 2 }, 2),
    corp('Comodă', { W: 800, H: 800, D: 450, nUsi: 0, nPol: 0, nSer: 4, hFront: 197, hCutie: 150 }, 3)
  ], OPT);

  assert.equal(r.totaluri.corpuri, 3);
  assert.equal(r.corpuri[1].poz, 2);
  assert.equal(r.piese.find(p => p.corpPoz === 2).cod, '2.1');

  /* fiecare corp își păstrează lista proprie, pentru foaia de montaj */
  assert.ok(r.corpuri.every(c => c.piese.length > 0 && c.feronerie.length > 0));

  /* materialele se cumulează peste corpuri */
  const pal18 = r.materiale.find(m => m.key === 'pal18');
  assert.ok(pal18.bucati > 15, 'prea puține piese de PAL 18');
  assert.ok(pal18.placi >= 1);
  assert.ok(r.materiale.some(m => m.key === 'pal16'), 'lipsește PAL-ul de 16 pentru cutiile de sertar');
});

test('comanda goală nu dă erori', () => {
  const r = raport(comanda(), [], OPT);
  assert.equal(r.totaluri.corpuri, 0);
  assert.equal(r.materiale.length, 0);
  assert.equal(r.cant.total, 0);
  assert.deepEqual(r.feronerie, []);
});
