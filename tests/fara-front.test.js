'use strict';
/* Comanda fără fronturi: se livrează doar corpul.

   Omul își cumpără ușile din altă parte — MDF vopsit, folie, sticlă — sau le
   are deja. Regula din care iese tot restul: CARCASA NU SE SCHIMBĂ. Ușa
   aplicată stă oricum în afara ei, cea încastrată stă în golul care rămâne,
   iar sertarele se așază după înălțimile fronturilor, fiindcă fronturile care
   vin pe urmă trebuie să cadă exact pe cutiile astea. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalRaport = require('../shared/raport');
const PalI18n = require('../shared/i18n');

const T = k => k;
const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');
const model = (id, extra) => Object.assign({}, PalModels.paramsFor(id, T), extra || {});
const fronturi = r => r.P.filter(p => p.rol === 'front');
const carcasa = r => r.P.filter(p => p.rol !== 'front')
                        .map(p => [p.cheie, p.buc, p.TL, p.Tl]);

/* ---------------- ce se schimbă și ce nu ---------------- */

test('carcasa iese la milimetru aceeași, la toate modelele din catalog', () => {
  /* Dacă asta cade, undeva am legat o cotă de corp la existența unui front —
     și atunci un corp comandat fără uși nu se mai potrivește cu ușile pe
     care le aduce omul mai târziu. */
  const toate = PalModels.modele(T).map(m => m.id);
  assert.ok(toate.length >= 40, 'catalogul s-a subțiat: ' + toate.length);

  toate.forEach(id => {
    const cu = PalCalc.calc(model(id), T);
    const fara = PalCalc.calc(model(id, { faraFront: 1 }), T);
    assert.deepEqual(carcasa(fara), carcasa(cu), id + ': s-a mișcat carcasa');
    assert.equal(fronturi(fara).length, 0, id + ': au rămas fronturi');
    assert.equal(fara.usi.length, 0, id + ': a rămas lista de uși');
    assert.deepEqual([fara.Wint, fara.Hint, fara.Dint],
                     [cu.Wint, cu.Hint, cu.Dint], id + ': s-a schimbat interiorul');
  });
});

test('cutiile de sertar se fac; numai fronturile lor nu', () => {
  /* Cutia e treabă de carcasă: se face din PAL, în atelier, și se montează pe
     glisiere. Frontul e ce se vede. */
  const r = PalCalc.calc(model('baza-4sertare', { faraFront: 1 }), T);
  const chei = r.P.map(p => p.cheie);
  ['sertarLaterala', 'sertarFataSpate', 'sertarFund'].forEach(k => {
    assert.ok(chei.includes(k), 'lipsește ' + k);
  });
  assert.ok(!chei.includes('frontSertar'), 'a rămas frontul de sertar');
});

test('cu faraFront pe 0 nu se schimbă nimic față de cum era', () => {
  const a = PalCalc.calc(model('baza-2usi'), T);
  const b = PalCalc.calc(model('baza-2usi', { faraFront: 0 }), T);
  assert.deepEqual(b.P.map(p => [p.cheie, p.buc, p.TL, p.Tl]),
                   a.P.map(p => [p.cheie, p.buc, p.TL, p.Tl]));
  assert.equal(PalCalc.defaults().faraFront, 0, 'corpul întreg nu mai e felul obișnuit');
  assert.deepEqual(a.avertismente, []);
});

test('se spune câte piese au rămas afară', () => {
  /* Cine se uită la o listă de debitare fără uși trebuie să afle DE CE.
     Altfel pleacă din atelier un corp fără fronturi din greșeală. */
  const r = PalCalc.calc(model('baza-2usi', { faraFront: 1 }), T);
  const a = r.avertismente.filter(x => x.cheie === 'faraFronturi')[0];
  assert.ok(a, 'nu se spune nimic');
  assert.equal(a.args.cate, 2, 'numărul de piese e greșit');
});

test('cotele fronturilor nu se pierd: le face cineva', () => {
  /* Fronturile nu se taie AICI, dar omul le comandă în altă parte și are
     nevoie de cote. Dacă ies din listă și nu se mai scriu nicăieri, comanda
     pleacă fără singura informație de care are nevoie celălalt atelier. */
  const cu = PalCalc.calc(model('baza-2usi'), T);
  const usa = cu.P.filter(p => p.cheie === 'usa')[0];
  const a = PalCalc.calc(model('baza-2usi', { faraFront: 1 }), T)
                   .avertismente.filter(x => x.cheie === 'faraFronturi')[0];
  assert.ok(a.args.cote, 'lipsesc cotele');
  /* Cota FINITĂ, nu cea de tăiere: reducerea de cant e a atelierului ăsta,
     nu a celui care face fronturile. */
  assert.match(a.args.cote, new RegExp(usa.L + '×' + usa.l),
    'cotele nu sunt cele finite: ' + a.args.cote);
  assert.ok(a.args.cote.indexOf(String(usa.TL)) === -1,
    's-au scris cotele de tăiere, care nu-i spun nimic altui atelier');
});

test('la mai multe feluri de front se scriu toate cotele', () => {
  /* Coloana de cuptor are un canat sub nișă și unul deasupra, de înălțimi
     diferite. O singură cotă ar trimite omul să comande două uși la fel. */
  const a = PalCalc.calc(model('coloana-cuptor', { faraFront: 1 }), T)
                   .avertismente.filter(x => x.cheie === 'faraFronturi')[0];
  assert.equal(a.args.cote.split(',').length, 2,
    'nu se scriu ambele feluri: ' + a.args.cote);
});

test('un corp care n-avea fronturi oricum nu se plânge', () => {
  const r = PalCalc.calc(model('etajera-cuburi', { faraFront: 1 }), T);
  assert.equal(fronturi(r).length, 0);
  assert.ok(!r.avertismente.some(x => x.cheie === 'faraFronturi'),
    'un corp deschis n-are ce fronturi să piardă');
});

test('schema primește doar 0 sau 1', () => {
  const schema = PalCalc.paramsSchema;
  if (!schema) return;
  const da = v => schema.parse(model('baza-2usi', { faraFront: v })).faraFront;
  assert.equal(da(1), 1);
  assert.equal(da('1'), 1);
  assert.equal(da(0), 0);
  assert.equal(da(7), 0, 'orice altceva înseamnă corp cu fronturi');
  assert.equal(da(-1), 0);
  assert.equal(da('aiurea'), 0);
});

/* ---------------- feroneria ---------------- */

function feronerie(id, extra) {
  const params = model(id, extra);
  const t = PalCalc.traducator(T);
  return PalRaport.feronerie(params, PalCalc.calc(params, t), null, t)
    .reduce((o, x) => { o[x.nume] = x.qty; return o; }, {});
}

test('fără fronturi nu se cumpără balamale, mânere sau șuruburi de mâner', () => {
  const cu = feronerie('baza-2usi');
  const fara = feronerie('baza-2usi', { faraFront: 1 });
  const dispar = Object.keys(cu).filter(k => /balama|maner|fero\.art\.(maner|surubManer)/i.test(k));
  assert.ok(dispar.length >= 2, 'nu găsesc feroneria de front în lista de pornire');
  dispar.forEach(k => assert.ok(!fara[k], 'a rămas ' + k));
});

test('glisierele, minifixul și suporții de poliță rămân', () => {
  /* Cutiile se fac, carcasa se asamblează, polițele se pun: nimic din asta
     nu ține de fronturi. */
  const cu = feronerie('baza-4sertare');
  const fara = feronerie('baza-4sertare', { faraFront: 1 });
  Object.keys(cu).filter(k => !/balama|maner/i.test(k))
    .forEach(k => assert.equal(fara[k], cu[k], 's-a schimbat ' + k));
});

test('balamaua de carte cuplează două fronturi: fără ele nu se pune', () => {
  const cu = feronerie('colt-jos-L');
  const fara = feronerie('colt-jos-L', { faraFront: 1 });
  const carte = Object.keys(cu).filter(k => /carte/i.test(k))[0];
  assert.ok(carte, 'corpul în L nu mai cere balama de carte');
  assert.ok(!fara[carte], 'a rămas balamaua de carte');
});

test('mânerele se numără pe fronturile tăiate, nu pe cele cerute', () => {
  /* Coloana de cuptor cere o ușă și scoate două canaturi, unul sub nișă și
     unul deasupra. Cu `nUsi + nSer` ieșea un singur mâner, adică lipsea unul
     din comandă. */
  const params = model('coloana-cuptor');
  const t = PalCalc.traducator(T);
  const res = PalCalc.calc(params, t);
  const taiate = fronturi(res).reduce((s, p) => s + p.buc, 0);
  assert.ok(taiate > (+params.nUsi + +params.nSer),
    'modelul nu mai are mai multe canaturi decât uși cerute — mută proba pe altul');
  const lista = feronerie('coloana-cuptor');
  const maner = Object.keys(lista).filter(k => /^fero\.art\.maner$|maner/i.test(k))
                      .filter(k => !/surub/i.test(k))[0];
  assert.equal(lista[maner], taiate, 'mânerele nu se potrivesc cu canaturile');
});

/* ---------------- ce se vede ---------------- */

test('desenul arată fronturile punctate, nu le șterge', () => {
  /* Un card fără nimic în față ar arăta ca un corp deschis, adică alt corp. */
  ['baza-2usi', 'baza-4sertare', 'colt-jos-L', 'colt-jos-diagonal',
   'colt-jos-orb', 'atipic-sub-scara'].forEach(id => {
    const cu = PalModels.sketch(model(id));
    const fara = PalModels.sketch(model(id, { faraFront: 1 }));
    assert.ok(!/ fara"/.test(cu), id + ': desenul obișnuit iese punctat');
    assert.ok(/ fara"/.test(fara), id + ': desenul fără fronturi nu iese punctat');
  });
});

test('fără fronturi nu se desenează mânere', () => {
  const s = PalModels.sketch(model('baza-4sertare', { faraFront: 1 }));
  assert.ok(!/sk-maner/.test(s), 'un mâner care plutește în gol');
  assert.ok(/sk-maner/.test(PalModels.sketch(model('baza-4sertare'))),
    'mânerele au dispărut și de la corpul întreg');
});

test('stilul punctat există în foaia de stil', () => {
  const css = citeste('public', 'styles.css');
  assert.match(css, /\.sk-front\.fara\{/, 'clasa nu are stil, deci desenul iese plin');
  assert.match(css, /\.sk-usa\.fara\{/);
});

test('cardul scrie „fără fronturi"', () => {
  PalI18n.inregistreaza('ro', JSON.parse(citeste('locales', 'ro.json')));
  const t = PalI18n.creeaza('ro');
  assert.match(PalModels.rezumat(model('baza-2usi', { faraFront: 1 }), t), /fără fronturi/);
  assert.ok(!/fronturi/.test(PalModels.rezumat(model('baza-2usi'), t)),
    'scrie de fronturi și la un corp întreg');
});

/* ---------------- unde se cere ---------------- */

test('se cere din editor și se poate ține minte ca setare', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /id="faraFront"/);
  assert.match(vedere, /editor\.fronturiNuSeFac/);
  const app = citeste('public', 'app.js');
  assert.match(app, /var fields = \[[^\]]*'faraFront'/, 'editorul nu trimite semnul la calcul');
  assert.deepEqual(require('../shared/models').campuriGrup('faraFront'), ['faraFront'], 'nu se poate ține minte');
  assert.match(app, /grupFaraFront|g\.arata/, 'setarea s-ar arăta ca un „1"');
});

test('se cere și din comandă: pe un corp, sau pe toate', () => {
  const vedere = citeste('views', 'orders', 'show.ejs');
  assert.match(vedere, /<option value="fara"/, 'lipsește din selectorul de material');
  assert.match(vedere, /comanda\.toateFaraFronturi/, 'lipsește butonul pe toată comanda');
  assert.match(vedere, /comanda\.puneFronturileInapoi/, 'nu se poate întoarce');

  const rute = citeste('src', 'orders.js');
  assert.match(rute, /router\.post\('\/orders\/:id\/fronturi'/, 'lipsește ruta pe comandă');
  assert.match(rute, /=== 'fara'/, 'selectorul de material nu știe de „fara"');
  assert.match(rute, /faraFront: fara/, 'apăsarea nu scrie în parametrii corpului');
});

test('tiparul nu cere montatorului să pună uși care nu există', () => {
  const montaj = citeste('views', 'orders', 'print-montaj.ejs');
  assert.match(montaj, /nUsi && !\+c\.params\.faraFront.*pasUsi/,
    'fișa de montaj are pasul cu ușile nepăzit');
  assert.match(montaj, /faraFront \? t\('rezumat\.faraFront'\)/);
  assert.match(citeste('views', 'orders', 'print-corpuri.ejs'),
    /faraFront \? t\('rezumat\.faraFront'\)/, 'lista de corpuri nu spune nimic');
});

/* ---------------- limbile ---------------- */

test('toate cele nouă chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['editor.fronturi', 'editor.fronturiSeFac', 'editor.fronturiNuSeFac',
                'avert.faraFronturi', 'setari.grupFaraFront', 'rezumat.faraFront',
                'comanda.faraFronturi', 'comanda.toateFaraFronturi',
                'comanda.puneFronturileInapoi'];
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
    /* Cele două cifre din mesaj: câte piese au rămas afară și ce cote au.
       Fără ele omul citește un text din care lipsește tocmai ce-i trebuie. */
    assert.match(String(ia(c, 'avert.faraFronturi')), /\{cate\}/,
      l.cod + ': s-a pierdut numărul de piese');
    assert.match(String(ia(c, 'avert.faraFronturi')), /\{cote\}/,
      l.cod + ': s-au pierdut cotele fronturilor');
  });
});
