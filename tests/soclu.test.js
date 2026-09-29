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

/* ---------------- soclul ca setare de atelier ----------------

   Un atelier care lucrează fără picioare lucrează așa LA TOATE corpurile de
   pe podea, nu la unul. Se pune o dată în setări și vine singur. */

test('categoriile care stau pe podea sunt cele care stau pe podea', () => {
  /* Un corp suspendat n-are pe ce sta; un soclu acolo ar fi o bucată de PAL
     tăiată degeaba și o cotă greșită pe foaie. */
  [['baza-2usi', true], ['baza-sertar-usa', true], ['coloana-cuptor', true],
   ['dulap-glisant', true], ['baie-lavoar', true],
   ['sus-2usi', false], ['sus-1usa', false], ['sus-hota', false], ['sus-raft', false],
   /* Colturile si cele atipice stau si ele pe podea, dar motorul nu stie sa le
      puna soclu: acolo lateralele nu merg drept in jos. Mai bine lipseste
      decat sa iasa un avertisment la fiecare corp. */
   ['colt-sus-L', false], ['colt-jos-L', false], ['atipic-mansarda', false]
  ].forEach(([id, asteptat]) => {
    assert.equal(PalModels.staPePodea(id), asteptat, id + ' e pus greșit');
  });
});

test('un model necunoscut nu primește soclu', () => {
  /* Mai bine lipsește soclul decât să apară unde nu trebuie. */
  ['habar-n-am', '', null, undefined, 0].forEach(x => {
    assert.equal(PalModels.staPePodea(x), false, JSON.stringify(x) + ' a trecut');
  });
});

test('soclul e o grupă de setări a lui, nu se amestecă cu dimensiunile', () => {
  /* Lățimea și înălțimea sunt ale corpului; soclul e felul de-a lucra al
     atelierului. Dacă ar fi în aceeași grupă, cine vrea soclul ar fi nevoit
     să-și pironească și cotele. */
  const app = citeste('public', 'app.js');
  assert.match(app, /\{ id: 'soclu',\s+camp: \['soclu'\]/);
  assert.ok(!/id: 'dimensiuni',\s+camp: \[[^\]]*soclu/.test(app),
    'soclul s-a amestecat în grupa dimensiunilor');
});

test('setarea nu se pune pe corpurile suspendate', () => {
  const app = citeste('public', 'app.js');
  assert.match(app, /if \(g\.id === 'soclu' && !DATA\.pePodea\) return;/);
  /* și semnalul chiar ajunge în pagină */
  assert.match(citeste('views', 'corps', 'edit.ejs'), /pePodea: pePodea/);
  assert.match(citeste('src', 'corps.js'), /pePodea: PalModels\.staPePodea/);
});

test('soclul pus din setări ridică înălțimea, nu fură din corp', () => {
  /* `H` e cota de la podea. Un soclu de 80 pus sub un corp de 720 fără să
     crească H ar da un interior de 604 — adică am fura din corp, nu am pune
     soclu dedesubt. Modelul a spus 720 de corp folositor; atâta rămâne. */
  const app = citeste('public', 'app.js');
  assert.match(app, /var socluInainte = \+params\.soclu \|\| 0;/);
  assert.match(app, /params\.H = \+params\.H \+ \(socluDupa - socluInainte\);/);
});

test('eticheta grupei există în toate cele treizeci de limbi', () => {
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    const v = c.setari && c.setari.grupSoclu;
    assert.ok(v && String(v).trim(), l.cod + ': lipsește setari.grupSoclu');
  });
});

/* ---------------- soclul se vede în schița de pe card ----------------

   „Corp bază pe soclu" avea exact același desen ca „Corp bază cu 2 uși":
   schița nu știa de soclu deloc. Cine se uită la catalog n-avea de unde ști
   care pe ce stă — și tocmai asta cauți când alegi. */

test('schița arată soclul, și numai când e', () => {
  assert.match(PalModels.sketch(PalModels.paramsFor('baza-2usi-soclu', T)), /sk-soclu/);
  assert.match(PalModels.sketch(PalModels.paramsFor('coloana-cuptor', T)), /sk-soclu/);
  assert.ok(!/sk-soclu/.test(PalModels.sketch(PalModels.paramsFor('baza-2usi', T))),
    'a apărut un soclu la un corp pe picioare');
  assert.ok(!/sk-soclu/.test(PalModels.sketch(PalModels.paramsFor('sus-2usi', T))),
    'a apărut un soclu la un corp suspendat');
});

test('în schiță, ușile se opresc deasupra soclului', () => {
  /* Altfel desenul ar arăta o ușă care coboară peste soclu — adică exact
     ce nu se întâmplă în atelier. */
  const p = PalModels.paramsFor('baza-2usi-soclu', T);
  const svg = PalModels.sketch(p);

  const soclu = svg.match(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" class="sk-soclu"/);
  assert.ok(soclu, 'nu găsesc soclul în schiță');
  const sucluSus = Number(soclu[1]);

  const fronturi = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)" class="sk-front"/g)];
  assert.ok(fronturi.length >= 1, 'nu găsesc ușile în schiță');
  fronturi.forEach(f => {
    const jos = Number(f[1]) + Number(f[2]);
    assert.ok(jos <= sucluSus + 0.01,
      'o ușă coboară până la ' + jos + ', peste soclul care începe la ' + sucluSus);
  });
});

test('schița nu arată corpul mai înalt decât e', () => {
  /* `H` e cota de la podea, soclu inclus. Golul interior trebuie să se
     oprească deasupra soclului, nu să treacă prin el. */
  const p = PalModels.paramsFor('baza-2usi-soclu', T);
  const svg = PalModels.sketch(p);
  const gol = svg.match(/y="([\d.]+)" width="[\d.]+" height="([\d.]+)" class="sk-gol"/);
  assert.ok(gol);
  const golJos = Number(gol[1]) + Number(gol[2]);
  assert.ok(golJos <= (+p.H - +p.soclu) + 0.01,
    'golul interior intră în zona soclului');
});

test('cardul spune în scris pe ce stă corpul', () => {
  /* Desenul e mic; scrisul nu lasă loc de îndoială. */
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const t = PalI18n.creeaza('ro');
  PalI18n.inregistreaza('ro', ro);

  const cuSoclu = PalModels.rezumat(PalModels.paramsFor('baza-2usi-soclu', t), t);
  assert.match(cuSoclu, /80/, 'rezumatul nu spune nimic despre soclu');

  const faraSoclu = PalModels.rezumat(PalModels.paramsFor('baza-2usi', t), t);
  assert.ok(!/soclu/i.test(faraSoclu),
    'scrie „soclu" și la un corp pe picioare — „pe picioare" e felul obișnuit, nu se scrie pe fiecare card');
});

test('textul de pe card există în toate cele treizeci de limbi', () => {
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const param = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    const v = c.rezumat && c.rezumat.peSoclu;
    assert.ok(v && String(v).trim(), l.cod + ': lipsește rezumat.peSoclu');
    assert.equal(param(v), param(ro.rezumat.peSoclu), l.cod + ': parametrul {h} s-a pierdut');
  });
});
