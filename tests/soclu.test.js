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
   /* Colturile de jos primesc soclu; cele suspendate nu, desi stau in
      aceeasi categorie. Cele atipice nu: forma lor vine din contur. */
   ['colt-jos-L', true], ['colt-jos-diagonal', true], ['colt-jos-orb', true],
   ['colt-dressing', true], ['colt-baie', true],
   ['colt-sus-L', false], ['colt-sus-diagonal', false], ['atipic-mansarda', false]
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
  assert.deepEqual(PalModels.campuriGrup('soclu'), ['soclu']);
  assert.ok(PalModels.campuriGrup('dimensiuni').indexOf('soclu') === -1,
    'soclul s-a amestecat în grupa dimensiunilor');
});

test('setarea nu se pune pe corpurile suspendate', () => {
  const p = { soclu: 0, H: 720 };
  PalModels.aplicaSetari(p, { grupe: { soclu: true }, val: { soclu: 80 } }, { pePodea: false });
  assert.deepEqual(p, { soclu: 0, H: 720 }, 'soclu pus pe un corp suspendat');
  assert.match(citeste('public', 'app.js'), /pePodea: DATA\.pePodea/);
  /* și semnalul chiar ajunge în pagină */
  assert.match(citeste('views', 'corps', 'edit.ejs'), /pePodea: pePodea/);
  assert.match(citeste('src', 'corps.js'), /pePodea: PalModels\.staPePodea/);
});

test('soclul pus din setări ridică înălțimea, nu fură din corp', () => {
  /* `H` e cota de la podea. Un soclu de 80 pus sub un corp de 720 fără să
     crească H ar da un interior de 604 — adică am fura din corp, nu am pune
     soclu dedesubt. Modelul a spus 720 de corp folositor; atâta rămâne. */
  const p = { soclu: 0, H: 720 };
  PalModels.aplicaSetari(p, { grupe: { soclu: true }, val: { soclu: 80 } }, { pePodea: true });
  assert.deepEqual(p, { soclu: 80, H: 800 });
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

/* ---------------- colțurile pe soclu ----------------

   Ramura de colț își taie singură piesele. Până acum nu știa de soclu:
   fundul stătea pe podea, iar un colț pus lângă corpurile pe soclu ieșea
   cu 80 de milimetri mai jos decât ele. */

function colt(id, extra) {
  return Object.assign({}, PalModels.paramsFor(id, T), { soclu: 80, H: 800 }, extra || {});
}

test('colțul fără soclu iese exact ca înainte', () => {
  ['colt-jos-L', 'colt-jos-diagonal', 'colt-sus-L', 'colt-jos-orb'].forEach(id => {
    const a = PalCalc.calc(PalModels.paramsFor(id, T), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
    const b = PalCalc.calc(Object.assign(PalModels.paramsFor(id, T), { soclu: 0 }), T)
      .P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
    assert.deepEqual(b, a, id);
  });
});

test('colțul în L pe soclu: două bucăți, fundul și fronturile urcă', () => {
  const p = colt('colt-jos-L');
  const r = PalCalc.calc(p, T);
  assert.deepEqual(r.warn, []);

  const s = piesa(r, 'soclu');
  assert.equal(s.length, 2, 'un colț în L are două brațe, deci două bucăți');
  const bA = p.W - p.t, bB = p.W2 - p.t;
  /* Brațul 1 trece peste capătul brațului 2, cu grosimea plăcii. */
  assert.equal(s[0].L, bA - p.D + p.t);
  assert.equal(s[1].L, bB - p.D);
  s.forEach(x => assert.equal(x.l, 80));

  assert.equal(piesa(r, 'fund')[0].boxes[0].y, 80, 'fundul a rămas pe podea');
  const fara = PalCalc.calc(PalModels.paramsFor('colt-jos-L', T), T);
  assert.equal(piesa(r, 'usaBrat1')[0].L, piesa(fara, 'usaBrat1')[0].L,
    'ușa s-a schimbat: soclul trebuia pus SUB corp, nu luat din el');
  assert.equal(piesa(r, 'usaBrat1')[0].boxes[0].y, 80 + p.rm);
  assert.equal(piesa(r, 'spatePerete1')[0].L, piesa(fara, 'spatePerete1')[0].L,
    'spatele a coborât în zona soclului');
});

test('colțul pe diagonală pe soclu: o bucată, cu unghiurile scrise pe ea', () => {
  const r = PalCalc.calc(colt('colt-jos-diagonal'), T);
  assert.deepEqual(r.warn, []);
  const s = piesa(r, 'soclu');
  assert.equal(s.length, 1);
  assert.equal(s[0].L, r.colt.diag, 'soclul nu e cât diagonala fronturilor');
  assert.equal(s[0].notaCheie, 'socluDiagonal');
  assert.deepEqual(s[0].notaArgs, { u1: 45, u2: 45 });

  /* Brațe diferite, unghiuri diferite — asta nu se ghicește la fierăstrău. */
  const inegal = PalCalc.calc(colt('colt-jos-diagonal', { W2: 1200 }), T);
  const u = piesa(inegal, 'soclu')[0].notaArgs;
  assert.notEqual(u.u1, u.u2);
  assert.equal(u.u1 + u.u2, 90);
});

test('colțul orb pe soclu primește soclul ca un corp drept', () => {
  const r = PalCalc.calc(colt('colt-jos-orb'), T);
  assert.deepEqual(r.warn, []);
  assert.equal(piesa(r, 'soclu').length, 1);
});

test('polițele colțului pe soclu nu coboară în soclu', () => {
  const r = PalCalc.calc(colt('colt-dressing', { H: 2080 }), T);
  const pol = piesa(r, 'polita')[0].boxes.map(b => b.y);
  assert.ok(Math.min.apply(null, pol) > 80 + 18, 'o poliță a ajuns sub fund');
});

test('corpurile atipice tot nu primesc soclu, și se spune', () => {
  const r = PalCalc.calc(Object.assign(PalModels.paramsFor('atipic-mansarda', T), { soclu: 80 }), T);
  assert.equal(piesa(r, 'soclu').length, 0);
  assert.ok(r.avertismente.some(a => a.cheie === 'socluNuMerge'));
});

test('avertismentul de soclu numește construcțiile cum le scrie editorul', () => {
  /* Omul caută în editor cuvintele din avertisment. Dacă nu le găsește
     acolo, avertismentul nu-l ajută. */
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    const ro = JSON.parse(citeste('locales', 'ro.json'));
    const ed = c.editor || {};
    const v = c.avert.socluNuMerge;
    assert.ok(v.indexOf(ed.constrIntre || ro.editor.constrIntre) !== -1, l.cod + ': lipsește constrIntre');
    assert.ok(v.indexOf(ed.constrPeste || ro.editor.constrPeste) !== -1, l.cod + ': lipsește constrPeste');
  });
});

test('notele soclului de colț au text în toate limbile, cu aceiași parametri', () => {
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  const param = t => (String(t).match(/\{[a-zA-Z0-9]+\}/g) || []).sort().join(',');
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    ['socluColtL', 'socluDiagonal'].forEach(k => {
      assert.ok(c.nota[k], l.cod + ': lipsește nota.' + k);
      assert.equal(param(c.nota[k]), param(ro.nota[k]), l.cod + ': parametri schimbați la ' + k);
    });
  });
});
