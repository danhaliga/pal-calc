'use strict';
/* Raportul unei comenzi: piese, materiale, cant, plăci, feronerie, CNC. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { raport, feronerie, materialPiesa, rolPiesa, muchiiFrontale, planseCnc, planColi, FORMATE } =
  require('../shared/raport');
const { calc, defaults } = require('../shared/calc');

const OPT = { effortMs: 0, adaosCant: 15 };   /* fără restarturi randomizate: teste rapide */

const mat = (over) => Object.assign({
  id: 1, nume: 'PAL alb', rol: 'corp', brand: 'Egger',
  decor_cod: 'W1000 ST9', decor_nume: 'Alb Premium', hex: '#fafcf2',
  pal_mm: 18, cant_gros: 2, cant_subtire: 0.4
}, over);

const matFronturi = mat({
  id: 2, nume: 'Fronturi stejar', rol: 'front',
  decor_cod: 'H1180 ST37', decor_nume: 'Stejar Halifax natur', hex: '#b79873'
});

const comanda = (over) => Object.assign({
  id: 1, name: 'Bucătărie test', formate: ['intreaga'], materiale: [mat()]
}, over);

const corp = (nume, over, poz, mats) => ({
  id: poz || 1, name: nume, poz: poz || 1,
  params: Object.assign(defaults(), { nume }, over),
  materiale: mats || { corp: mat(), front: mat(), sertar: mat() }
});

/* ---------------- piese și materiale ---------------- */

test('un corp de bază: piese, materiale și bucăți', () => {
  const r = raport(comanda(), [corp('Corp bază', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);

  assert.equal(r.totaluri.corpuri, 1);
  assert.equal(r.totaluri.randuri, 6);
  assert.equal(r.totaluri.bucati, 8);

  const chei = r.materiale.map(m => m.key).sort();
  assert.deepEqual(chei, ['Egger|W1000 ST9|18', 'PFL|3']);
  assert.equal(r.materiale.find(m => m.key === 'Egger|W1000 ST9|18').coliIntregi, 1);
  assert.equal(r.materiale.find(m => m.key === 'PFL|3').coliIntregi, 1);
});

test('rolul piesei se deduce din nume', () => {
  assert.equal(rolPiesa('Laterală'), 'corp');
  assert.equal(rolPiesa('Ușă'), 'front');
  assert.equal(rolPiesa('Ușă braț 1'), 'front');
  assert.equal(rolPiesa('Front sertar'), 'front');
  assert.equal(rolPiesa('Spate PFL aplicat'), 'spate');
  assert.equal(rolPiesa('Sertar – laterală cutie'), 'sertar');
  assert.equal(rolPiesa('Sertar – fund PFL'), 'pfl');
});

test('materialul unei piese vine din rolul ei', () => {
  const c = Object.assign(defaults(), { t: 18, tp: 3, ts: 16 });
  const mats = { corp: mat(), front: matFronturi, sertar: mat({ id: 3, decor_cod: 'W980 ST2', decor_nume: 'Alb' }) };

  assert.equal(materialPiesa({ nume: 'Laterală' }, c, mats).key, 'Egger|W1000 ST9|18');
  assert.equal(materialPiesa({ nume: 'Ușă' }, c, mats).key, 'Egger|H1180 ST37|18');
  assert.equal(materialPiesa({ nume: 'Spate PFL aplicat' }, c, mats).key, 'PFL|3');
  assert.equal(materialPiesa({ nume: 'Sertar – laterală cutie' }, c, mats).key, 'Egger|W980 ST2|16');
  assert.equal(materialPiesa({ nume: 'Sertar – fund PFL' }, c, mats).key, 'PFL|3');
  assert.equal(materialPiesa({ nume: 'Spate PAL aplicat' }, Object.assign({}, c, { tp: 18 }), mats).key,
               'Egger|W1000 ST9|18');
});

test('fronturile în alt decor merg pe materialul lor', () => {
  const mats = { corp: mat(), front: matFronturi, sertar: mat() };
  const r = raport(comanda({ materiale: [mat(), matFronturi] }),
                   [corp('Corp', { nUsi: 2, nPol: 1 }, 1, mats)], OPT);

  const usa = r.piese.find(p => p.nume === 'Ușă');
  assert.equal(usa.material.decor, 'H1180 ST37');
  assert.equal(r.piese.find(p => p.nume === 'Laterală').material.decor, 'W1000 ST9');
  assert.equal(r.materiale.length, 3);      // PAL alb, PAL stejar, PFL
});

test('cantul fronturilor se ia din materialul fronturilor', () => {
  const mats = { corp: mat(), front: matFronturi.id ? Object.assign({}, matFronturi, { cant_gros: 1 }) : null,
                 sertar: mat() };
  const r = raport(comanda({ materiale: [mat(), mats.front] }),
                   [corp('Corp', { W: 800, H: 720, nUsi: 2, nPol: 0 }, 1, mats)], OPT);

  const usa = r.piese.find(p => p.nume === 'Ușă');
  assert.equal(usa.L, 717);
  assert.equal(usa.TL, 715);                // 717 − 2×1 (cant de 1 mm)
  const lat = r.piese.find(p => p.nume === 'Laterală');
  assert.equal(lat.TL, 718);                // carcasa rămâne pe cant de 2 mm
});

/* ---------------- cant ---------------- */

test('metrii de cant, pe grosimi și pe decor', () => {
  const r = raport(comanda(), [corp('Corp bază', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);

  const gros = r.cant.linii.find(x => x.mm === 2);
  const subtire = r.cant.linii.find(x => x.mm === 0.4);

  assert.equal(gros.ml, 8.19);
  assert.equal(subtire.ml, 2.23);
  assert.equal(gros.decor, 'Alb Premium');
  assert.equal(gros.cuAdaos, 9.42);
  assert.equal(subtire.cuAdaos, 2.56);
});

test('adaosul la cant nu poate coborî sub 10%', () => {
  const r = raport(comanda(), [corp('Corp', { nUsi: 1, nPol: 0 })], { effortMs: 0, adaosCant: 2 });
  assert.equal(r.cant.adaosPct, 10);
});

test('cantul unei piese arată grosimea pe fiecare muchie', () => {
  const r = raport(comanda(), [corp('Corp', { nUsi: 0, nPol: 0 })], OPT);
  const lat = r.piese.find(p => p.nume === 'Laterală');
  assert.deepEqual(lat.cant.muchii, ['2', '–', '0.4', '0.4']);
});

/* ---------------- coli, jumătăți și sferturi ---------------- */

test('optimizatorul poate folosi jumătăți și sferturi de coală', () => {
  const doarIntreaga = raport(comanda({ formate: ['intreaga'] }),
    [corp('Corp mic', { W: 600, H: 400, D: 300, nUsi: 1, nPol: 0, spate: 'aplicat' })], OPT);
  const cuBucati = raport(comanda({ formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert'] }),
    [corp('Corp mic', { W: 600, H: 400, D: 300, nUsi: 1, nPol: 0, spate: 'aplicat' })], OPT);

  const palIntreg = doarIntreaga.materiale.find(m => m.tip === 'PAL');
  const palBucati = cuBucati.materiale.find(m => m.tip === 'PAL');

  assert.equal(palIntreg.bucatiColi[0].format.id, 'intreaga');
  assert.ok(palBucati.echivalent < palIntreg.echivalent,
    `un corp mic trebuie să încapă pe mai puțin de o coală (${palBucati.echivalent} vs ${palIntreg.echivalent})`);
  assert.ok(palBucati.deseuPct < palIntreg.deseuPct, 'deșeul trebuie să scadă');
  assert.equal(palBucati.coliIntregi, 1);
});

test('echivalentul în coli se rotunjește în sus la cumpărare', () => {
  const r = raport(comanda({ formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert'] }),
    [corp('Corp', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);
  r.materiale.forEach(m => {
    assert.equal(m.coliIntregi, Math.ceil(m.echivalent - 0.001), m.nume);
    assert.ok(m.echivalent <= m.coliIntregi + 0.001, m.nume);
  });
});

test('formatele de coală au fracțiile corecte', () => {
  assert.equal(FORMATE['intreaga'].frac, 1);
  assert.equal(FORMATE['jum-lat'].frac, 0.5);
  assert.equal(FORMATE['jum-lung'].frac, 0.5);
  assert.equal(FORMATE['sfert'].frac, 0.25);
  assert.equal(FORMATE['jum-lat'].w * FORMATE['jum-lat'].h * 2, FORMATE['intreaga'].w * FORMATE['intreaga'].h);
  assert.equal(FORMATE['sfert'].w * FORMATE['sfert'].h * 4, FORMATE['intreaga'].w * FORMATE['intreaga'].h);
});

test('încadrarea desenează fiecare piesă din coală', () => {
  const r = raport(comanda(), [corp('Corp bază', { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 })], OPT);
  const pal = r.materiale.find(m => m.tip === 'PAL');
  const svg = planColi(pal.bins[0], pal);

  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('coala-fond'), 'lipsește coala');
  assert.equal((svg.match(/class="coala-piesa"/g) || []).length, pal.bins[0].placements.length);
  assert.ok(svg.includes('1.1'), 'lipsesc codurile pieselor');
});

/* ---------------- feronerie ---------------- */

test('feroneria unui corp cu două uși și o poliță', () => {
  const params = Object.assign(defaults(), { W: 800, H: 720, D: 560, nUsi: 2, nPol: 1 });
  const items = feronerie(params, calc(params));
  const get = n => (items.find(x => new RegExp(n).test(x.nume)) || {}).qty;

  assert.equal(get('^Balama cupă'), 4);
  assert.equal(get('Euroșurub'), 16);
  assert.equal(get('Suport poliță'), 4);
  assert.equal(get('Confirmat'), 12);
  assert.equal(get('^Mâner$'), 2);
  assert.equal(get('Holșurub'), 21);
});

test('feroneria unui corp cu sertare include glisierele', () => {
  const params = Object.assign(defaults(), { nUsi: 0, nPol: 0, nSer: 3, hFront: 237, hCutie: 180 });
  const items = feronerie(params, calc(params));
  const glis = items.find(x => /glisiere/.test(x.nume));
  assert.equal(glis.qty, 3);
  assert.match(glis.nume, /500 mm/);
});

/* ---------------- CNC ---------------- */

test('corpul în L trimite blatul și fundul la CNC, cu decupajul cotat', () => {
  const r = raport(comanda(),
    [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 2, nPol: 0 })], OPT);

  assert.equal(r.cnc.length, 2);
  const blat = r.cnc.find(x => x.piesa === 'Blat');
  assert.equal(blat.tip, 'Decupaj colț interior');
  assert.match(blat.detalii, /decupaj 322 × 322 mm din colț/);
  assert.equal(blat.gabarit.L, 882);
});

test('colțul diagonal cere tăiere la 45°', () => {
  const r = raport(comanda(),
    [corp('Colț', { tip: 'colt-diagonal', W: 900, W2: 900, D: 560, nUsi: 1, nPol: 0 })], OPT);
  const blat = r.cnc.find(x => x.piesa === 'Blat');
  assert.equal(blat.tip, 'Tăiere la 45°');
  assert.match(blat.detalii, /muchie diagonală 455\.4 mm/);
});

test('nutul pentru spate intră în lista de prelucrări', () => {
  const r = raport(comanda(), [corp('Corp', { spate: 'nut', nUsi: 0, nPol: 0 })], OPT);
  assert.equal(r.cnc.filter(x => x.tip === 'Nut pentru spate').length, 3);
});

test('corpul drept cu spate aplicat nu are prelucrări CNC', () => {
  const r = raport(comanda(), [corp('Corp', { nUsi: 2, nPol: 1 })], OPT);
  assert.equal(r.cnc.length, 0);
});

test('cantul panourilor de colț se pune pe muchiile frontale', () => {
  const r = raport(comanda(),
    [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 0, nPol: 0 })], OPT);
  const blat = r.piese.find(p => p.nume === 'Blat');
  assert.equal(blat.cant.special, true);
  assert.equal(blat.cant.ml, 0.64);
});

test('muchiile frontale sunt doar cele care nu stau pe gabarit', () => {
  const L = [[0, 0], [882, 0], [882, 560], [560, 560], [560, 882], [0, 882]];
  assert.equal(muchiiFrontale(L).length, 2);
  const pentagon = [[0, 0], [882, 0], [882, 560], [560, 882], [0, 882]];
  assert.equal(muchiiFrontale(pentagon).length, 1);
});

test('planșa CNC este un SVG cu piesa și gabaritul', () => {
  const r = raport(comanda(),
    [corp('Colț', { tip: 'colt-L', W: 900, W2: 900, D: 560, nUsi: 2, nPol: 0 })], OPT);
  const svg = planseCnc(r.cnc[0]);
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('cnc-gabarit') && svg.includes('cnc-piesa'));
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
  assert.ok(r.corpuri.every(c => c.piese.length > 0 && c.feronerie.length > 0));

  const pal18 = r.materiale.find(m => m.key === 'Egger|W1000 ST9|18');
  assert.ok(pal18.bucati > 15);
  assert.ok(r.materiale.some(m => m.gros === 16), 'lipsește PAL-ul de 16 pentru cutiile de sertar');
});

test('comanda goală nu dă erori', () => {
  const r = raport(comanda(), [], OPT);
  assert.equal(r.totaluri.corpuri, 0);
  assert.equal(r.materiale.length, 0);
  assert.equal(r.cant.total, 0);
  assert.deepEqual(r.feronerie, []);
});
