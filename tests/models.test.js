'use strict';
/* Verifica faptul ca fiecare model din catalog chiar se poate construi:
   parametri valizi, piese generate, fara avertismente. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { MODELS, CATEGORIES, paramsFor, sketch, rezumat, byId, modele, categorii, numeCorp } =
  require('../shared/models');
const { calc, paramsSchema } = require('../shared/calc');

/* Modelele ascunse nu sunt corpuri: „piesa simplă" e un singur panou, cu
   cardul ei în pagină. Testele care cer laterale, fronturi și schiță de corp
   se uită doar la corpuri; piesa își are proba ei, mai jos. */
const CORPURI = MODELS.filter(m => !m.ascuns);

test('identificatorii sunt unici, categoriile există', () => {
  const ids = new Set();
  const cats = new Set(CATEGORIES.map(c => c.id));
  for (const m of MODELS) {
    assert.ok(!ids.has(m.id), `id dublat: ${m.id}`);
    ids.add(m.id);
    assert.ok(cats.has(m.cat), `${m.id}: categorie necunoscută „${m.cat}”`);
  }
  assert.ok(MODELS.length >= 12, 'catalogul e prea mic');
});

test('fiecare model și fiecare categorie au nume și descriere în română', () => {
  categorii().forEach(c => {
    assert.ok(c.nume && !c.nume.startsWith('modele.'), `categoria ${c.id} nu are nume`);
    assert.ok(c.descriere && !c.descriere.startsWith('modele.'), `categoria ${c.id} nu are descriere`);
  });
  modele().forEach(m => {
    assert.ok(m.nume && !m.nume.startsWith('modele.'), `${m.id} nu are nume`);
    assert.ok(m.descriere && !m.descriere.startsWith('modele.'), `${m.id} nu are descriere`);
    assert.ok(!numeCorp(m.id).startsWith('modele.'), `${m.id} nu are nume de corp`);
  });
});

test('fiecare model trece validarea parametrilor', () => {
  for (const m of MODELS) {
    const res = paramsSchema.safeParse(paramsFor(m.id));
    assert.ok(res.success, `${m.id}: ${res.success ? '' : JSON.stringify(res.error.issues)}`);
  }
});

test('fiecare model produce piese cu cote pozitive', () => {
  for (const m of CORPURI) {
    const { P } = calc(paramsFor(m.id));
    assert.ok(P.length >= 3, `${m.id}: prea puține piese`);
    for (const p of P) {
      assert.ok(p.L > 0 && p.l > 0, `${m.id} / ${p.nume}: cotă finită ≤ 0`);
      assert.ok(p.TL > 0 && p.Tl > 0, `${m.id} / ${p.nume}: cotă de tăiere ≤ 0`);
      assert.ok(p.buc > 0, `${m.id} / ${p.nume}: bucăți ≤ 0`);
    }
  }
});

test('niciun model nu pornește cu avertismente', () => {
  for (const m of MODELS) {
    const { warn } = calc(paramsFor(m.id));
    assert.deepEqual(warn, [], `${m.id}: ${warn.join(' | ')}`);
  }
});

test('modelele cu sertare încap în înălțimea corpului', () => {
  for (const m of MODELS) {
    const p = paramsFor(m.id);
    if (!+p.nSer) continue;
    const ocupat = +p.nSer * (+p.hFront + +p.ri);
    assert.ok(ocupat <= +p.H - 2 * +p.rm + +p.ri + 1,
      `${m.id}: fronturile de sertar (${ocupat} mm) depășesc corpul (${p.H} mm)`);
    assert.ok(+p.hCutie <= +p.hFront, `${m.id}: cutia e mai înaltă decât frontul`);
  }
});

test('corpurile drepte au schiță frontală, proporțională cu corpul', () => {
  for (const m of MODELS) {
    const p = paramsFor(m.id);
    if (p.tip !== 'drept') continue;
    const svg = sketch(p);
    assert.match(svg, /^<svg /, `${m.id}: nu e SVG`);
    assert.ok(svg.includes(`viewBox="0 0 ${p.W} ${p.H}"`), `${m.id}: viewBox greșit`);
    const fronturi = (svg.match(/class="sk-front"/g) || []).length;
    assert.equal(fronturi, +p.nUsi + +p.nSer, `${m.id}: număr greșit de fronturi desenate`);
  }
});

test('corpurile atipice au schița conturului lor', () => {
  const atipice = MODELS.filter(m => paramsFor(m.id).tip === 'atipic');
  assert.ok(atipice.length >= 2, 'prea puține corpuri atipice în catalog');

  for (const m of atipice) {
    const p = paramsFor(m.id);
    const svg = sketch(p);
    assert.match(svg, /^<svg /, `${m.id}: nu e SVG`);
    const pts = svg.match(/<polygon points="([^"]+)"/);
    assert.ok(pts, `${m.id}: lipsește conturul`);
    assert.equal(pts[1].trim().split(/\s+/).length, p.contur.length,
      `${m.id}: conturul are alt număr de colțuri decât laturi`);
  }
});

test('corpurile de colț au schiță în plan, cu forma reală', () => {
  const forme = { 'colt-L': 6, 'colt-diagonal': 5 };
  for (const m of CORPURI) {
    const p = paramsFor(m.id);
    if (p.tip === 'drept' || p.tip === 'atipic') continue;
    const svg = sketch(p);
    assert.match(svg, /^<svg /, `${m.id}: nu e SVG`);

    if (p.tip === 'colt-orb') {
      assert.ok(svg.includes('class="sk-orb"'), `${m.id}: lipsește zona oarbă`);
      continue;
    }
    const pts = svg.match(/<polygon points="([^"]+)"/);
    assert.ok(pts, `${m.id}: lipsește conturul în plan`);
    assert.equal(pts[1].trim().split(/\s+/).length, forme[p.tip], `${m.id}: formă greșită`);

    const usi = (svg.match(/class="sk-usa"/g) || []).length;
    const asteptat = +p.nUsi === 0 ? 0 : (p.tip === 'colt-L' ? 2 : 1);
    assert.equal(usi, asteptat, `${m.id}: număr greșit de fronturi în plan`);
  }
});

test('catalogul acoperă colțuri pentru bucătărie jos, suspendate și alte camere', () => {
  const colturi = MODELS.filter(m => m.cat === 'colt');
  assert.ok(colturi.length >= 6, 'prea puține corpuri de colț');
  const tipuri = new Set(colturi.map(m => paramsFor(m.id).tip));
  assert.deepEqual([...tipuri].sort(), ['colt-L', 'colt-diagonal', 'colt-orb']);
  assert.ok(colturi.some(m => paramsFor(m.id).D >= 500), 'lipsește un colț de corp jos');
  assert.ok(colturi.some(m => paramsFor(m.id).D <= 320), 'lipsește un colț suspendat');
  assert.ok(colturi.some(m => paramsFor(m.id).H >= 1800), 'lipsește un colț înalt, pentru altă cameră');
});

test('rezumatul descrie conținutul corpului', () => {
  assert.equal(rezumat(paramsFor('baza-2usi')), '2 uși · 1 poliță');
  assert.equal(rezumat(paramsFor('baza-3sertare')), '3 sertare');
  assert.equal(rezumat(paramsFor('baza-nisa')), 'corp deschis');
});

test('un id inexistent nu dă parametri', () => {
  assert.equal(byId('nu-exista'), null);
  assert.equal(paramsFor('nu-exista'), null);
});

/* ---------------- piesa simplă ---------------- */

test('piesa simplă e un singur panou, nu un corp', () => {
  const p = paramsFor('piesa-simpla');
  assert.equal(p.tip, 'piesa');

  const { P, warn } = calc(p);
  assert.equal(P.length, 1, 'o piesă simplă n-are decât o piesă');
  assert.ok(P[0].L > 0 && P[0].l > 0 && P[0].TL > 0 && P[0].Tl > 0);
  assert.deepEqual(warn, [], `se plânge degeaba: ${warn.join(' | ')}`);
});

test('piesa simplă nu apare în grila pe categorii', () => {
  /* Are cardul ei lângă corpul gol; între corpurile de bucătărie ar deruta. */
  assert.ok(!modele().some(m => m.id === 'piesa-simpla'));
  assert.ok(byId('piesa-simpla'), 'dar trebuie să existe, ca să se poată crea');
});

test('schița piesei arată muchiile cantuite, nu un corp cu gol', () => {
  const svg = sketch(Object.assign(paramsFor('piesa-simpla'),
    { pcL1: 'g', pcL2: '-', pcl1: 's', pcl2: '-' }));
  assert.match(svg, /^<svg /);
  assert.ok(!/sk-gol|sk-front/.test(svg), 'desenează gol interior sau fronturi');
  assert.equal((svg.match(/sk-cant gros/g) || []).length, 1);
  assert.equal((svg.match(/sk-cant subtire/g) || []).length, 1);
});
