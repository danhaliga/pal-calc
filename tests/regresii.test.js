'use strict';
/* Două erori care au ajuns în producție și n-aveau niciun test.
   Fiecare bloc de mai jos cade dacă eroarea se întoarce. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { paramsSchema, defaults, calc, traducator } = require('../shared/calc');
const I18n = require('../shared/i18n');
const Raport = require('../shared/raport');
const Models = require('../shared/models');

const LOCALES = path.join(__dirname, '..', 'locales');

/* =====================================================================
   1. Conturul atipic: o latură greșită nu are voie să șteargă tot conturul

   Era `.catch([])` pe vector. O singură latură în afara limitelor — sau un
   câmp lăsat gol — golea conturul, salvarea răspundea „success", iar corpul
   devenea în tăcere un dreptunghi W×H. Dispărea și avertismentul „conturul
   nu se închide", fiindcă nu mai era nimic de închis.
   ===================================================================== */

const CONTUR_BUN = [
  { lung: 800, unghi: 90 }, { lung: 600, unghi: 90 }, { lung: 300, unghi: 135 },
  { lung: 424, unghi: 135 }, { lung: 300, unghi: 90 }
];

const cuContur = contur => Object.assign(defaults(), { tip: 'atipic', contur: contur });

test('conturul bun trece cu toate laturile', () => {
  const r = paramsSchema.safeParse(cuContur(CONTUR_BUN));
  assert.ok(r.success);
  assert.equal(r.data.contur.length, 5);
});

test('corpul drept trece cu contur gol — cazul obișnuit', () => {
  const r = paramsSchema.safeParse(Object.assign(defaults(), { tip: 'drept', contur: [] }));
  assert.ok(r.success, 'un corp drept nu are contur și trebuie să se salveze');
  assert.equal(r.data.contur.length, 0);
});

/* fiecare fel de greșeală, pe fiecare câmp */
const RELE = [
  ['lungime sub minim', 2, 'lung', 5],
  ['lungime peste maxim', 0, 'lung', 5000],
  ['lungime lăsată goală', 4, 'lung', ''],
  ['unghi sub minim', 3, 'unghi', 0],
  ['unghi peste maxim', 1, 'unghi', 400],
  ['unghi lăsat gol', 2, 'unghi', '']
];

RELE.forEach(([nume, idx, camp, val]) => {
  test(`o latură cu ${nume} e respinsă, nu înghițită`, () => {
    const contur = JSON.parse(JSON.stringify(CONTUR_BUN));
    contur[idx][camp] = val;
    const r = paramsSchema.safeParse(cuContur(contur));

    assert.equal(r.success, false,
      'validarea trebuie să CADĂ; dacă trece, conturul s-a golit în tăcere');

    /* și trebuie să spună exact care latură și care câmp, ca să se poată
       arăta „Latura 3: lungimea trebuie să fie între 10 și 4000 mm" */
    const vina = r.error.issues.find(i => i.path[0] === 'contur');
    assert.ok(vina, 'eroarea trebuie să indice conturul');
    assert.equal(vina.path[1], idx, 'indicele laturii');
    assert.equal(vina.path[2], camp, 'câmpul vinovat');
  });
});

test('un contur greșit nu se transformă niciodată în dreptunghiul W×H', () => {
  const contur = JSON.parse(JSON.stringify(CONTUR_BUN));
  contur[2].lung = 5;
  const r = paramsSchema.safeParse(cuContur(contur));
  if (r.success) {
    /* dacă vreodată se decide să treacă, măcar să nu ajungă gol */
    assert.notEqual(r.data.contur.length, 0,
      'conturul golit dă un dreptunghi fără niciun avertisment');
  }
});

test('mesajele pentru latura greșită există în toate cele 30 de limbi', () => {
  const coduri = I18n.LIMBI.map(l => l.cod);
  coduri.forEach(cod => {
    const t = I18n.creeaza(cod);
    ['editor.conturLungimeRea', 'editor.conturUnghiRau'].forEach(cheie => {
      const v = t(cheie, { n: 3 });
      assert.notEqual(v, cheie, `${cod}: lipsește ${cheie}`);
      assert.ok(v.includes('3'), `${cod}: ${cheie} nu scrie care latură`);
    });
  });
});

/* =====================================================================
   2. Raportul fără traducător: listele de producție ieșeau în română

   raport() traduce numele pieselor, notele de tăiere, formatele de coală,
   feroneria și operațiile CNC. Fără `optiuni.t`, traducator(undefined) cade
   pe română fără să crâcnească, așa că toate cele șase hârtii de atelier și
   ambele exporturi CSV ieșeau în română în celelalte 29 de limbi.
   ===================================================================== */

const MATERIAL = {
  id: 1, nume: 'PAL 18', rol: 'corp', hex: '#e9dcc0',
  pal_mm: 18, cant_gros: 2, cant_subtire: 0.4,
  brand: 'K', decor_cod: 'K1', decor_nume: 'Alb'
};

function comandaDeProba(t) {
  const corpuri = ['baza-2usi', 'colt-jos-L'].map((id, i) => ({
    id: i + 1, name: id, params: Models.paramsFor(id, t),
    material_id: 1, material_front_id: null, paid: 1
  }));
  const comanda = {
    id: 1, name: 'probă', formate: ['intreaga', 'jum-lat'],
    materiale: [MATERIAL], feronerie: null
  };
  return [comanda, corpuri];
}

/* Cuvinte care există numai în română. Dacă apar în raportul cerut în altă
   limbă, înseamnă că traducătorul nu a ajuns până acolo. */
const SEMNAL_RO = ['Laterală', 'Poliță', 'Spate PFL', 'coală întreagă', 'Mâner',
                   'Suport poliță', 'Cep lemn', 'se decupează'];

['en', 'de', 'ja', 'ar'].forEach(cod => {
  test(`raportul cerut în „${cod}" nu conține cuvinte românești`, () => {
    const t = I18n.creeaza(cod);
    const [comanda, corpuri] = comandaDeProba(t);
    const r = Raport.raport(comanda, corpuri, { t: t, effortMs: 30, adaosCant: 10 });

    /* tot textul pe care raportul îl produce: piese, note, feronerie, formate */
    const text = [
      r.piese.map(p => [p.nume, p.nota, p.cnc && p.cnc.operatie].join(' ')).join(' '),
      (r.feronerie || []).map(f => [f.nume, f.obs].join(' ')).join(' '),
      (r.necesar || []).map(m => Object.values(m.folosite || {}).join(' ') +
        ' ' + (m.coli || []).map(c => c.format && c.format.nume).join(' ')).join(' ')
    ].join(' ');

    const gasite = SEMNAL_RO.filter(w => text.includes(w));
    assert.deepEqual(gasite, [],
      `raportul în ${cod} a rămas în română la: ${gasite.join(', ')}`);
  });
});

/* Testele de mai sus dovedesc că raport() traduce când primește `t`. Eroarea
   reală era în altă parte: RUTELE nu-i dădeau niciun `t`. Un test care cheamă
   raport() direct nu prinde asta niciodată, deci aici ne uităm la apeluri. */

const SURSA_ORDERS = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders.js'), 'utf8');

test('fiecare apel raportComenzii() din rute trimite traducătorul', () => {
  const apeluri = SURSA_ORDERS.match(/raportComenzii\([^)]*\)/g) || [];
  const dinRute = apeluri.filter(a => !/^raportComenzii\(order, t, optiuni\)$/.test(a));
  assert.ok(dinRute.length >= 3, 'ar trebui să existe cel puțin 3 apeluri din rute');
  dinRute.forEach(a => {
    assert.match(a, /raportComenzii\(\s*[A-Za-z_$][\w$]*\s*,\s*req\.t/,
      `apelul \`${a}\` nu trimite req.t — listele de producție ies în română`);
  });
});

test('antetul CSV al comenzii vine din catalog, nu scris de mână', () => {
  /* era: const head = ['Corp', 'Cod', 'Piesa', ...] — românesc în toate limbile */
  /* până la `;`, ca să prindem și `.map(k => req.t(k))` de după paranteza dreaptă */
  const bloc = SURSA_ORDERS.match(/const head = \[[\s\S]*?;/);
  assert.ok(bloc, 'nu am găsit antetul CSV');
  assert.match(bloc[0], /req\.t/, 'antetul CSV trebuie să treacă prin req.t');
  assert.doesNotMatch(bloc[0], /'Piesa'|'Taiere L'|'Fibra'/,
    'antetul CSV conține încă text scris de mână în română');
});

test('vederea 3D a ansamblului cheamă calc() cu traducător', () => {
  const apeluri = SURSA_ORDERS.match(/PalCalc\.calc\([^)]*\)/g) || [];
  apeluri.forEach(a => {
    assert.match(a, /,\s*(req\.t|t)\s*\)/,
      `apelul \`${a}\` nu trimite traducătorul — numele pieselor ies în română`);
  });
});

test('raport() chemat fără traducător cade pe română — de asta e `t` obligatoriu', () => {
  const t = I18n.creeaza('ro');
  const [comanda, corpuri] = comandaDeProba(t);
  const fara = Raport.raport(comanda, corpuri, { effortMs: 30, adaosCant: 10 });
  const nume = fara.piese.map(p => p.nume).join(' ');
  assert.ok(nume.includes('Laterală'),
    'dacă asta cade, comportamentul implicit s-a schimbat: verifică apelurile din src/');
});

test('numele pieselor se traduc chiar, nu doar coloanele', () => {
  const ro = I18n.creeaza('ro');
  const de = I18n.creeaza('de');
  const nume = cod => {
    const t = I18n.creeaza(cod);
    const [comanda, corpuri] = comandaDeProba(t);
    return Raport.raport(comanda, corpuri, { t: t, effortMs: 30, adaosCant: 10 })
      .piese.map(p => p.nume);
  };
  const a = nume('ro'), b = nume('de');
  assert.equal(a.length, b.length, 'același număr de piese în ambele limbi');
  assert.notDeepEqual(a, b, 'numele pieselor trebuie să difere între română și germană');
  void ro; void de;
});

/* =====================================================================
   3. Cotele rămân identice în toate limbile

   Traducerea nu are voie să atingă niciun număr: separatorul zecimal și
   cifrele latine sunt aceleași peste tot, fiindcă un „556,2" într-o listă de
   tăiere se citește greșit în atelier.
   ===================================================================== */

test('cotele de debitare sunt identice în toate cele 30 de limbi', () => {
  const referinta = (() => {
    const t = I18n.creeaza('ro');
    const [comanda, corpuri] = comandaDeProba(t);
    return Raport.raport(comanda, corpuri, { t: t, effortMs: 30, adaosCant: 10 })
      .piese.map(p => [p.cod, p.TL, p.Tl, p.buc].join('|'));
  })();

  I18n.LIMBI.forEach(l => {
    const t = I18n.creeaza(l.cod);
    const [comanda, corpuri] = comandaDeProba(t);
    const cote = Raport.raport(comanda, corpuri, { t: t, effortMs: 30, adaosCant: 10 })
      .piese.map(p => [p.cod, p.TL, p.Tl, p.buc].join('|'));
    assert.deepEqual(cote, referinta, `cotele diferă în ${l.cod}`);
  });
});

test('nicio traducere nu strecoară cifre non-latine în cataloage', () => {
  /* cifrele arabe, persane, devanagari și thai n-au ce căuta: utilizatorul
     tastează 560 în formular și trebuie să citească 560 în lista de tăiere */
  const NELATINE = /[٠-٩۰-۹०-९๐-๙]/;
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const text = fs.readFileSync(path.join(LOCALES, f), 'utf8');
    const gasite = [...new Set(text.match(new RegExp(NELATINE, 'g')) || [])];
    assert.deepEqual(gasite, [], `${f} conține cifre non-latine: ${gasite.join(' ')}`);
  });
});
