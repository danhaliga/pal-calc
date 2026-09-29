'use strict';
/* Corpul care stă pe podea, fără picioare.

   Lateralele merg până jos, fundul se ridică, iar în față intră o bucată de
   PAL — soclul. Picioarele sunt feronerie și nu se taie din PAL, deci un
   corp pe picioare n-a avut niciodată piesa asta. */

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

function corp(extra) {
  return Object.assign({}, PalModels.paramsFor('baza-2usi', T), extra || {});
}
function piesa(rez, cheie) { return rez.P.filter(p => p.cheie === cheie); }

/* ---------------- fără soclu nu se schimbă nimic ---------------- */

test('un corp pe picioare iese exact ca înainte', () => {
  /* Toate corpurile de până azi n-au soclu. Dacă socoteala li se mișcă fie
     și cu o zecime, listele după care s-a tăiat deja nu mai sunt bune. */
  const a = PalCalc.calc(corp(), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const b = PalCalc.calc(corp({ soclu: 0 }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(b, a);
  assert.equal(piesa(PalCalc.calc(corp(), T), 'soclu').length, 0,
    'a apărut un soclu la un corp pe picioare');
});

test('valoarea implicită e zero, adică picioare', () => {
  assert.equal(PalCalc.defaults().soclu, 0);
});

/* ---------------- ce se schimbă cu soclu ---------------- */

test('lateralele merg până la podea, iar în față apare soclul', () => {
  const r = PalCalc.calc(corp({ H: 800, soclu: 80 }), T);
  const lat = piesa(r, 'laterala')[0];
  const soc = piesa(r, 'soclu')[0];

  assert.equal(lat.TL, 800, 'laterala nu ajunge la podea');
  assert.ok(soc, 'lipsește soclul din listă');
  assert.equal(soc.buc, 1);
  assert.equal(soc.Tl, 80, 'soclul n-are înălțimea cerută');
  assert.equal(soc.TL, piesa(r, 'fund')[0].TL, 'soclul nu e cât fundul — nu intră între laterale');
});

test('interiorul rămâne cât era, doar pornește mai sus', () => {
  /* Un corp de 800 cu soclu de 80 trebuie să aibă exact interiorul unuia de
     720 pe picioare: ușile, polițele și tot ce ține de ele ies la fel. */
  const peSoclu = PalCalc.calc(corp({ H: 800, soclu: 80 }), T);
  const pePicioare = PalCalc.calc(corp({ H: 720 }), T);

  assert.equal(peSoclu.Hint, pePicioare.Hint);
  ['usa', 'polita', 'blat', 'fund'].forEach(cheie => {
    const a = piesa(peSoclu, cheie)[0], b = piesa(pePicioare, cheie)[0];
    assert.ok(a && b, 'lipsește ' + cheie);
    assert.deepEqual([a.buc, a.TL, a.Tl], [b.buc, b.TL, b.Tl],
      cheie + ' iese altfel pe soclu decât pe picioare');
  });
});

test('spatele nu coboară în zona soclului', () => {
  /* Sub fund nu e corp, e gol. Un spate care coboară până la podea ar fi PFL
     tăiat degeaba, și s-ar vedea pe dinapoi. */
  const r = PalCalc.calc(corp({ H: 800, soclu: 80 }), T);
  const sp = piesa(r, 'spateAplicat')[0];
  const fara = piesa(PalCalc.calc(corp({ H: 720 }), T), 'spateAplicat')[0];
  assert.equal(sp.TL, fara.TL, 'spatele nu s-a scurtat cu soclul');
});

test('soclul se pune numai unde poate sta', () => {
  /* La construcția „peste", lateralele stau PE fund — un soclu dedesubt
     n-ar avea de ce se prinde. Se spune, nu se trece cu vederea. */
  const r = PalCalc.calc(corp({ H: 800, soclu: 80, constr: 'peste' }), T);
  assert.equal(piesa(r, 'soclu').length, 0);
  assert.ok(r.avertismente.some(a => a.cheie === 'socluNuMerge'),
    'soclul a fost lăsat deoparte fără să spună nimeni');
});

test('un soclu care nu lasă loc de corp se spune', () => {
  const r = PalCalc.calc(corp({ H: 180, soclu: 80 }), T);
  assert.ok(r.avertismente.some(a => a.cheie === 'socluPreaInalt'));
});

test('soclul nu poate fi negativ sau absurd', () => {
  const schema = PalCalc.schema && PalCalc.schema();
  if (!schema) return;
  assert.equal(schema.parse(corp({ soclu: -50 })).soclu, 0);
  assert.equal(schema.parse(corp({ soclu: 'aiurea' })).soclu, 0);
  assert.equal(schema.parse(corp({ soclu: 5000 })).soclu, 0);
  assert.equal(schema.parse(corp({ soclu: 80 })).soclu, 80);
});

/* ---------------- editorul îl poate cere ---------------- */

test('soclul are casetă în editor și ajunge la calcul', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /id="soclu"/, 'nu se poate scrie nicăieri');
  const app = citeste('public', 'app.js');
  assert.match(app, /'constr','soclu'/, 'editorul nu trimite soclul la calcul');
});

/* ---------------- modelele noi ---------------- */

const NOI = ['baza-2usi-soclu', 'baza-2sertare', 'baza-4sertare', 'baza-ingusta',
             'sus-2usi-600', 'sus-2usi-1000', 'coloana-camara', 'coloana-matura',
             'etajera-cuburi', 'bufet', 'dulap-pantofi'];

test('fiecare model nou iese fără niciun avertisment', () => {
  /* Un model din catalog care scoate avertismente e un model pe care nu-l
     poți da omului. */
  NOI.forEach(id => {
    const p = PalModels.paramsFor(id, T);
    assert.ok(p, 'lipsește modelul ' + id);
    const r = PalCalc.calc(p, T);
    assert.deepEqual(r.warn, [], id + ' scoate avertismente');
    assert.ok(r.P.length > 0, id + ' nu scoate nicio piesă');
  });
});

test('modelele pe soclu chiar au soclu în listă', () => {
  ['baza-2usi-soclu', 'coloana-camara', 'coloana-matura'].forEach(id => {
    const r = PalCalc.calc(PalModels.paramsFor(id, T), T);
    assert.equal(piesa(r, 'soclu').length, 1, id + ' n-are soclu');
  });
});

test('etajera cu cuburi scoate o grilă, nu polițe pe toată lățimea', () => {
  /* Cu 3 montanți și 3 polițe ies 4 coloane × 4 rânduri, adică 12 polițe
     scurte — nu 3 lungi cât tot corpul. */
  const r = PalCalc.calc(PalModels.paramsFor('etajera-cuburi', T), T);
  const pol = piesa(r, 'polita')[0];
  assert.equal(pol.buc, 12, 'nu iese grila de cuburi');
  assert.ok(pol.TL < 400, 'polița e cât tot corpul, deci nu e grilă');
  assert.equal(piesa(r, 'montant')[0].buc, 3);
});

test('corpul îngust are o lățime pe care o taie cineva', () => {
  const p = PalModels.paramsFor('baza-ingusta', T);
  assert.equal(p.W, 200);
  const r = PalCalc.calc(p, T);
  assert.deepEqual(r.warn, []);
});

/* ---------------- textele ---------------- */

test('soclul are nume în toate cele treizeci de limbi', () => {
  const chei = ['piesa.soclu', 'nota.socluInFata', 'editor.soclu',
                'avert.socluNuMerge', 'avert.socluPreaInalt'];
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
