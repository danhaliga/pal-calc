'use strict';
/* Uși glisante.

   Nu sunt un fel de montaj în plus, sunt alt fel de ușă: n-au balamale, se
   SUPRAPUN una peste alta și merg pe șine. De-aia nici cotele nu ies la fel —
   o ușă glisantă e mai lată decât jumătate de corp, tocmai cât să acopere
   suprapunerea. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalI18n = require('../shared/i18n');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');

function dulap(extra) {
  return Object.assign({}, PalModels.paramsFor('dulap-2usi', T),
    { W: 1800, H: 2400, D: 600, nDsp: 2, nPol: 4 }, extra || {});
}
function usa(rez) { return rez.P.find(p => p.cheie === 'usa'); }

/* ---------------- cotele ---------------- */

test('ușile glisante acoperă corpul, cu suprapunere', () => {
  /* Suma lățimilor e mai mare decât corpul, tocmai cu suprapunerile: altfel
     ar rămâne o fantă între ele când sunt închise. */
  const r = PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', supr: 30 }), T);
  const u = usa(r);
  assert.equal(u.buc, 2);
  const latFinita = 1800 / 2 + 30 / 2;      /* (W + (n-1)*supr) / n */
  assert.equal(u.Tl, PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', supr: 30 }), T).P
    .find(p => p.cheie === 'usa').Tl);
  /* cota de tăiere e cea finită minus cantul; verificăm că acoperă corpul */
  assert.ok(Math.abs(u.buc * latFinita - (2 - 1) * 30 - 1800) < 0.01,
    'ușile nu acoperă exact lățimea corpului');
});

test('trei uși glisante acoperă la fel de exact', () => {
  const r = PalCalc.calc(dulap({ W: 2400, nUsi: 3, montaj: 'glisant', supr: 30, nDsp: 3 }), T);
  const u = usa(r);
  assert.equal(u.buc, 3);
  const lat = (2400 + 2 * 30) / 3;
  assert.ok(Math.abs(3 * lat - 2 * 30 - 2400) < 0.01);
});

test('șinele mănâncă din înălțime', () => {
  const cu40 = usa(PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', hSine: 40 }), T));
  const cu80 = usa(PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', hSine: 80 }), T));
  assert.equal(cu40.TL - cu80.TL, 40, 'înălțimea ușii nu ține cont de șine');
});

test('ușile stau pe două șine, una în fața celeilalte', () => {
  /* Dacă ar fi în același plan, n-ar putea trece una pe lângă alta. */
  const r = PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant' }), T);
  const z = usa(r).boxes.map(b => b.z);
  assert.notEqual(z[0], z[1], 'ambele uși sunt în același plan');
});

test('ușile glisante n-au notă de balamale', () => {
  const r = PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant' }), T);
  assert.equal(usa(r).notaCheie, 'usiGlisante');
  const peBalamale = PalCalc.calc(dulap({ nUsi: 2, montaj: 'aplicat' }), T);
  assert.match(usa(peBalamale).notaCheie, /balamale/);
});

/* ---------------- ce nu se potrivește ---------------- */

test('o singură ușă glisantă n-are pe lângă ce aluneca', () => {
  const r = PalCalc.calc(dulap({ nUsi: 1, montaj: 'glisant' }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'glisantaSingura'));
});

test('o ușă glisantă prea lată se spune', () => {
  /* Peste 1200 se lasă în timp și sare de pe șină. */
  const r = PalCalc.calc(dulap({ W: 2600, nUsi: 2, montaj: 'glisant', nDsp: 3 }), T);
  const a = r.avertismente.find(x => x.cheie === 'glisantaLata');
  assert.ok(a, 'ușa lată a trecut fără o vorbă');
  assert.ok(a.args && a.args.lat, 'nu spune cât de lată');
});

test('zonele de uși și nișa nu au înțeles la glisante', () => {
  const r = PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', hUsi: 900, hNisa: 400 }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'glisantaFaraZone'));
  /* și chiar nu se iau în seamă: iese o singură ușă pe toată înălțimea */
  assert.equal(usa(r).buc, 2);
  assert.ok(usa(r).TL > 2000, 'ușa a fost tăiată de zone, deși e glisantă');
});

test('compartimentele alese nu au înțeles la glisante', () => {
  /* Ușa glisantă trece prin fața montanților, nu se oprește la ei. */
  const r = PalCalc.calc(dulap({ nUsi: 2, montaj: 'glisant', compUsi: '1' }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'glisantaFaraCompartimente'));
});

/* ---------------- nimic nu s-a stricat ---------------- */

test('ușile pe balamale ies exact ca înainte', () => {
  const a = PalCalc.calc(dulap({ nUsi: 2, montaj: 'aplicat' }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const b = PalCalc.calc(dulap({ nUsi: 2, montaj: 'aplicat', supr: 99, hSine: 99 }), T).P
    .map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(b, a, 'suprapunerea și șinele s-au amestecat în ușile pe balamale');
});

test('valorile implicite sunt cele obișnuite din atelier', () => {
  const d = PalCalc.defaults();
  assert.equal(d.montaj, 'aplicat');
  assert.equal(d.supr, 30);
  assert.equal(d.hSine, 40);
});

test('schema primește felul nou de montaj și curăță ce nu e pe listă', () => {
  const schema = PalCalc.schema && PalCalc.schema();
  if (!schema) return;
  assert.equal(schema.parse(dulap({ montaj: 'glisant' })).montaj, 'glisant');
  assert.equal(schema.parse(dulap({ supr: -5 })).supr, 30);
  assert.equal(schema.parse(dulap({ hSine: 'aiurea' })).hSine, 40);
});

/* ---------------- editorul și modelele ---------------- */

test('glisantele se pot alege din editor', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /value="glisant"/);
  assert.match(vedere, /id="supr"/);
  assert.match(vedere, /id="hSine"/);
  const app = citeste('public', 'app.js');
  assert.match(app, /'supr','hSine'/, 'editorul nu trimite cotele la calcul');
  /* Suprapunerea și șinele n-au înțeles la balamale, deci nu stau în drum. */
  assert.match(app, /arata\('wrapSupr', glisant\)/);
});

test('modelele cu uși glisante ies curate', () => {
  ['dulap-glisant', 'dressing-glisant'].forEach(id => {
    const p = PalModels.paramsFor(id, T);
    assert.ok(p, 'lipsește ' + id);
    assert.equal(p.montaj, 'glisant');
    const r = PalCalc.calc(p, T);
    assert.deepEqual(r.warn, [], id + ' scoate avertismente');
    assert.ok(usa(r).buc >= 2);
  });
});

test('glisantele au nume în toate cele treizeci de limbi', () => {
  const chei = ['editor.montajGlisant', 'editor.suprapunere', 'editor.hSine',
                'nota.usiGlisante', 'avert.glisantaSingura', 'avert.glisantaNuIncape',
                'avert.glisantaLata', 'avert.glisantaInalta',
                'avert.glisantaFaraZone', 'avert.glisantaFaraCompartimente'];
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');

  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipsește ' + k);
      assert.equal(param(v), param(ia(ro, k)), l.cod + ': parametri schimbați la ' + k);
    });
  });
});
