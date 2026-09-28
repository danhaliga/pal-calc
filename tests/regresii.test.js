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

/* =====================================================================
   4. Numerotarea corpurilor: o planșă nu are voie să numere altfel decât alta

   Planșa de ansamblu numerota cu `i + 1` — în tabel repornind de la 1 pe
   fiecare perete, în planul de sus indexul din vector. Restul hârtiilor și
   codurile de piese din lista de debitare folosesc corps.poz. Într-o cameră
   cu două ziduri existau doi „corp 1". Cine citea „corpul 2 de pe peretele B"
   lua panourile marcate 2.1 și 2.2 — ale altui corp.
   ===================================================================== */

const Ansamblu = require('../shared/ansamblu');

const corpPozitionat = (id, nr, nume, over, pozitie) => ({
  id: id, nume: nume, poz: nr, pozitie: pozitie ? JSON.stringify(pozitie) : null,
  params: Object.assign(defaults(), { nume: nume }, over)
});

const CAMERA = { id: 1, name: 'x', camera: JSON.stringify({ A: 3000, B: 3000, H: 2500 }) };

test('numărul din ansamblu e numărul din comandă, nu indexul din vector', () => {
  /* corpul cu poz = 3 a fost șters, deci numerele au un gol */
  const corpuri = [
    corpPozitionat(11, 1, 'Jos A1', { W: 800 }, { perete: 'A', d: 0, h: 0 }),
    corpPozitionat(12, 2, 'Jos A2', { W: 600 }, { perete: 'A', d: 800, h: 0 }),
    corpPozitionat(14, 4, 'Sus B1', { W: 800 }, { perete: 'B', d: 0, h: 1400 })
  ];
  const r = Ansamblu.ansamblu(CAMERA, corpuri, I18n.creeaza('ro'));

  assert.deepEqual(r.asezari.map(a => a.nr), [1, 2, 4],
    'al treilea corp are poz 4; dacă apare 3, s-a folosit indexul din vector');

  /* și planul de sus trebuie să deseneze aceleași numere */
  const desenate = (r.plan.match(/>(\d+)<\/text>/g) || [])
    .map(s => Number(s.replace(/\D/g, '')));
  assert.ok(desenate.includes(4), 'planul nu desenează numărul 4');
  assert.ok(!desenate.includes(3), 'planul desenează 3, adică indexul, nu numărul din comandă');
});

test('două corpuri pe pereți diferiți nu primesc același număr', () => {
  const corpuri = [
    corpPozitionat(21, 1, 'A1', { W: 800 }, { perete: 'A', d: 0, h: 0 }),
    corpPozitionat(22, 2, 'A2', { W: 600 }, { perete: 'A', d: 800, h: 0 }),
    corpPozitionat(23, 3, 'B1', { W: 900 }, { perete: 'B', d: 0, h: 0 }),
    corpPozitionat(24, 4, 'B2', { W: 400 }, { perete: 'B', d: 900, h: 0 })
  ];
  const r = Ansamblu.ansamblu(CAMERA, corpuri, I18n.creeaza('ro'));

  const numere = r.asezari.map(a => a.nr);
  assert.equal(new Set(numere).size, numere.length,
    'numerele se repetă: ' + numere.join(', '));

  /* pe fiecare perete, numerele rămân cele din comandă — nu 1,2 / 1,2 */
  const pePerete = {};
  r.pereti.forEach(p => { if (p.corpuri.length) pePerete[p.id] = p.corpuri.map(a => a.nr); });
  assert.deepEqual(pePerete.A, [1, 2]);
  assert.deepEqual(pePerete.B, [3, 4], 'peretele B trebuie să arate 3 și 4, nu 1 și 2');
});

test('elevația scrie numărul corpului, nu doar lățimea', () => {
  const corpuri = [
    corpPozitionat(31, 7, 'Unu', { W: 600, H: 720 }, { perete: 'A', d: 0, h: 0 }),
    corpPozitionat(32, 8, 'Doi', { W: 600, H: 720 }, { perete: 'A', d: 600, h: 0 })
  ];
  const r = Ansamblu.ansamblu(CAMERA, corpuri, I18n.creeaza('ro'));
  const el = Ansamblu.elevatie(r.asezari, r.camera, 'A');

  /* două corpuri de aceeași lățime: fără numere, desenul nu spune care e care */
  assert.match(el, />7</, 'lipsește numărul 7 din elevație');
  assert.match(el, />8</, 'lipsește numărul 8 din elevație');
  assert.match(el, />600</, 'lățimea rămâne utilă, trebuie să apară și ea');
});

test('numărul din ansamblu se potrivește cu codul piesei din debitare', () => {
  const t = I18n.creeaza('ro');
  const corpuri = [
    corpPozitionat(41, 2, 'Jos', { W: 800 }, { perete: 'A', d: 0, h: 0 }),
    corpPozitionat(42, 5, 'Sus', { W: 600 }, { perete: 'B', d: 0, h: 1400 })
  ];
  const ans = Ansamblu.ansamblu(CAMERA, corpuri, t);

  const comanda = { id: 1, name: 'x', formate: ['intreaga'], materiale: [MATERIAL], feronerie: null };
  const pentruRaport = corpuri.map(c => ({
    id: c.id, name: c.nume, poz: c.poz, params: c.params,
    material_id: 1, material_front_id: null, paid: 1
  }));
  const rap = Raport.raport(comanda, pentruRaport, { t: t, effortMs: 30, adaosCant: 10 });

  ans.asezari.forEach(a => {
    const piese = rap.piese.filter(p => p.cod.split('.')[0] === String(a.nr));
    assert.ok(piese.length > 0,
      `corpul ${a.nr} din ansamblu nu are nicio piesă codată ${a.nr}.x în debitare`);
  });
});

test('fără numărul din comandă se cade pe ordinal, nu pe undefined', () => {
  /* fixturi vechi, fără coloana poz — desenul nu are voie să scrie „undefined" */
  const fara = [
    { id: 51, nume: 'Unu', pozitie: null, params: Object.assign(defaults(), { W: 800 }) },
    { id: 52, nume: 'Doi', pozitie: null, params: Object.assign(defaults(), { W: 600 }) }
  ];
  const r = Ansamblu.ansamblu(CAMERA, fara, I18n.creeaza('ro'));
  assert.deepEqual(r.asezari.map(a => a.nr), [1, 2]);
  assert.doesNotMatch(r.plan, /undefined/);
});

test('corpul îngust de umplutură primește totuși numărul pe elevație', () => {
  /* lățimea are trei cifre și nu încape într-un corp de 150 mm, dar numărul
     are una — și tocmai corpul de umplutură e cel greu de identificat */
  const corpuri = [
    corpPozitionat(61, 1, 'Lat', { W: 800, H: 720 }, { perete: 'A', d: 0, h: 0 }),
    corpPozitionat(62, 2, 'Umplutură', { W: 150, H: 720 }, { perete: 'A', d: 800, h: 0 })
  ];
  const r = Ansamblu.ansamblu(CAMERA, corpuri, I18n.creeaza('ro'));
  const el = Ansamblu.elevatie(r.asezari, r.camera, 'A');

  assert.match(el, />1</, 'corpul lat trebuie să aibă număr');
  assert.match(el, />2</, 'corpul îngust trebuie să aibă număr');
  assert.match(el, />800</, 'corpul lat are loc și pentru lățime');
  assert.doesNotMatch(el, />150</, 'lățimea nu încape în corpul îngust, și e în tabel');
});

/* =====================================================================
   5. Reperul de atelier: piese din lucrări chiar executate

   50 de piese din patru lucrări FALCESCU, fiecare cu cota finită din
   programul CNC (WoodWOP .mpr) și cota de debitare din fișierul de panel saw
   (Holzma .saw). Lucrările au trecut prin atelier și s-au asamblat, deci
   cotele sunt corecte prin construcție.

   Testul ăsta a prins două greșeli pe care nimic altceva nu le vedea:
   cantul se scădea de pe axa greșită, și se scădea grosimea întreagă în loc
   de cât ia de fapt banda.
   ===================================================================== */

const REPER = require('./reper-atelier.json');
const { reducereCant } = require('../shared/calc');

/* aceeași aritmetică pe care o face calc(): muchiile paralele cu L (L1/L2)
   scad din l, cele paralele cu l (W1/W2) scad din L */
function debiteaza(finitL, finitl, cant) {
  const [L1, L2, W1, W2] = cant.map(g => reducereCant(g));
  return {
    L: Math.round((finitL - W1 - W2) * 10) / 10,
    l: Math.round((finitl - L1 - L2) * 10) / 10
  };
}

test('reperul de atelier are piese din toate cele patru lucrări', () => {
  assert.ok(REPER.piese.length >= 40, 'prea puține piese în reper');
  const lucrari = new Set(REPER.piese.map(p => p.lucrare));
  assert.ok(lucrari.size >= 3, 'reperul trebuie să acopere mai multe lucrări');
});

test('cotele de debitare ies exact ca la atelier, pe toate cele 50 de piese', () => {
  const gresite = [];
  REPER.piese.forEach(p => {
    const d = debiteaza(p.finitL, p.finitl, p.cant);
    if (Math.abs(d.L - p.taiereL) > 0.051 || Math.abs(d.l - p.taierel) > 0.051) {
      gresite.push(`${p.lucrare} ${p.cod}: finit ${p.finitL}×${p.finitl} cant [${p.cant}] ` +
                   `— atelier ${p.taiereL}×${p.taierel}, noi ${d.L}×${d.l}`);
    }
  });
  assert.deepEqual(gresite, [],
    gresite.length + ' piese ies altfel decât la atelier:\n  ' + gresite.slice(0, 8).join('\n  '));
});

test('regula veche — scade grosimea întreagă, de pe axa L — chiar cădea pe reper', () => {
  /* dovada că testul are dinți: modelul de dinainte nu reproduce reperul */
  let gresite = 0;
  REPER.piese.forEach(p => {
    const [L1, L2, W1, W2] = p.cant;
    const L = Math.round((p.finitL - L1 - L2) * 10) / 10;
    const l = Math.round((p.finitl - W1 - W2) * 10) / 10;
    if (Math.abs(L - p.taiereL) > 0.051 || Math.abs(l - p.taierel) > 0.051) gresite++;
  });
  assert.ok(gresite > 20,
    'modelul vechi ar trebui să cadă pe multe piese; a căzut pe ' + gresite);
});

test('grosimile de cant dau reducerile din atelier', () => {
  assert.equal(reducereCant(2), 1.5, 'banda de 2 mm ia 1.5 — măsurat pe lucrări');
  assert.equal(reducereCant(1), 0.5, 'banda de 1 mm ia 0.5 — confirmat de atelier');
  assert.equal(reducereCant(0.8), 0, 'banda de 0.8 nu schimbă cota — măsurat');
  assert.equal(reducereCant(0.4), 0, 'banda de 0.4 nu schimbă cota — măsurat');
  assert.equal(reducereCant(0), 0);
});

test('pragul stă la 0.8, nu la 1', () => {
  /* Perechea asta fixează pragul: 0.8 nu scade nimic, 1 scade 0.5. Dacă pragul
     ar fi 1, banda de 1 mm — pe care atelierul chiar o folosește — n-ar scădea
     nimic, iar piesele ar ieși cu 1 mm mai mari pe o axă. */
  assert.equal(reducereCant(0.8), 0, 'la prag, inclusiv, nu se scade nimic');
  assert.ok(reducereCant(0.81) > 0, 'imediat peste prag se scade');
  assert.equal(reducereCant(1), 0.5);
});

test('formatele de coală sunt cele din fișierele Holzma ale atelierului', () => {
  const F = Raport.FORMATE || require('../shared/raport').FORMATE;
  assert.deepEqual([F['intreaga'].w, F['intreaga'].h], [2800, 2070]);
  assert.deepEqual([F['jum-lung'].w, F['jum-lung'].h], [2800, 1030]);
  assert.deepEqual([F['sfert'].w, F['sfert'].h], [1390, 1030]);
  assert.notEqual(F['jum-lung'].h, 1035, 'jumătatea aritmetică nu se poate tăia');
});

/* =====================================================================
   6. Montantul (despărțitorul)

   În lucrările atelierului codul e DSP și apare în trei din patru lucrări,
   într-una cu 36 de bucăți. Se prinde de blat și de fund exact ca o laterală:
   aceleași dibluri Ø8 în cant la capete și aceleași excentrice Ø15 la 25 mm.
   Găurile de poliță îl străpung (Ø5 × 18 pe placă de 18), deci o gaură
   slujește ambele compartimente.
   ===================================================================== */

const { paramsSchema: schemaM } = require('../shared/calc');

const cuMontanti = over => schemaM.parse(Object.assign(
  defaults(), { W: 1800, H: 720, D: 560, t: 18 }, over));

test('montantul are înălțimea interioară și adâncimea lateralei', () => {
  const { P } = calc(cuMontanti({ nDsp: 2 }));
  const m = P.find(p => p.cheie === 'montant');
  const lat = P.find(p => p.cheie === 'laterala');
  assert.ok(m, 'trebuie să existe piesa montant');
  assert.equal(m.buc, 2);
  assert.equal(m.L, 684, 'înălțimea = H − 2t');
  assert.equal(m.l, lat.l, 'aceeași adâncime ca laterala');
});

test('montanții împart interiorul în compartimente egale', () => {
  /* Wint = 1800 − 36 = 1764 */
  const cazuri = [[0, 1763], [1, 872], [2, 575], [3, 426.5]];
  cazuri.forEach(([nDsp, latPolita]) => {
    const { P } = calc(cuMontanti({ nDsp: nDsp, nPol: 1 }));
    const pol = P.find(p => p.cheie === 'polita');
    assert.equal(pol.L, latPolita, nDsp + ' montanți: lățimea poliței');
    assert.equal(pol.buc, nDsp + 1, nDsp + ' montanți: câte o poliță pe compartiment');
  });
});

test('polițele se numără pe compartiment, nu pe corp', () => {
  const { P } = calc(cuMontanti({ nDsp: 2, nPol: 3 }));
  const pol = P.find(p => p.cheie === 'polita');
  assert.equal(pol.buc, 9, '3 polițe × 3 compartimente');
});

test('montantul scoate avertismentul de poliță lungă, fiindcă asta rezolvă', () => {
  const fara = calc(cuMontanti({ nDsp: 0, nPol: 1 }));
  const cu = calc(cuMontanti({ nDsp: 2, nPol: 1 }));
  assert.ok(fara.avertismente.some(a => a.cheie === 'politaLunga'),
    'fără montant, polița de 1763 mm trebuie să dea avertisment');
  assert.ok(!cu.avertismente.some(a => a.cheie === 'politaLunga'),
    'cu doi montanți, polița scade sub 800 și avertismentul trebuie să dispară');
});

test('ușile care nu se împart la compartimente dau avertisment', () => {
  const rau = calc(cuMontanti({ nDsp: 3, nUsi: 2 }));
  assert.ok(rau.avertismente.some(a => a.cheie === 'usiPesteMontant'),
    '2 uși pe 4 compartimente: una ar cădea peste un montant');

  const bun = calc(cuMontanti({ nDsp: 2, nUsi: 3 }));
  assert.ok(!bun.avertismente.some(a => a.cheie === 'usiPesteMontant'));

  const multiplu = calc(cuMontanti({ nDsp: 1, nUsi: 4 }));
  assert.ok(!multiplu.avertismente.some(a => a.cheie === 'usiPesteMontant'),
    '4 uși pe 2 compartimente e în regulă: două pe compartiment');
});

test('corpul fără montanți iese exact ca înainte', () => {
  /* nDsp = 0 e implicit, deci corpurile existente nu au voie să se schimbe */
  const a = calc(cuMontanti({ nPol: 2, nUsi: 2 }));
  const b = calc(cuMontanti({ nDsp: 0, nPol: 2, nUsi: 2 }));
  assert.deepEqual(a.P.map(p => [p.cheie, p.buc, p.L, p.l, p.TL, p.Tl]),
                   b.P.map(p => [p.cheie, p.buc, p.L, p.l, p.TL, p.Tl]));
  assert.ok(!a.P.some(p => p.cheie === 'montant'));
});

test('fiecare montant aduce două îmbinări și patru suporți pe poliță', () => {
  const material = { id: 1, nume: 'PAL 18', rol: 'corp', hex: '#e9dcc0', pal_mm: 18,
                     cant_gros: 2, cant_subtire: 0.8, brand: 'K', decor_cod: 'K1', decor_nume: 'Alb' };
  const t = I18n.creeaza('ro');
  const cere = (nDsp, nPol) => {
    const p = schemaM.parse(Object.assign(defaults(t),
      { W: 1800, H: 720, D: 560, nDsp: nDsp, nPol: nPol, nUsi: nDsp + 1 }));
    const r = Raport.raport({ id: 1, name: 'x', formate: ['intreaga'], materiale: [material], feronerie: null },
      [{ id: 1, name: 'Corp', poz: 1, params: p, material_id: 1, material_front_id: null, paid: 1 }],
      { t: t, effortMs: 30, adaosCant: 10 });
    const ia = re => (r.feronerie.find(x => re.test(x.nume)) || {}).qty;
    return { excentric: ia(/Excentric/), cep: ia(/Cep lemn/), suport: ia(/Suport poliță/) };
  };

  const fara = cere(0, 2);
  assert.equal(fara.excentric, 4, 'fără montant: patru îmbinări');
  assert.equal(fara.suport, 8, '2 polițe × 4 suporți');

  const cu = cere(2, 2);
  assert.equal(cu.excentric, 8, 'doi montanți: 4 + 2×2 îmbinări');
  assert.equal(cu.cep, 16, 'câte două dibluri pe îmbinare');
  assert.equal(cu.suport, 24, '2 polițe × 3 compartimente × 4 suporți');
});

/* =====================================================================
   7. Setările implicite ale editorului

   Stau în browserul omului (localStorage), deci niciun test de aici nu le
   poate rula. Ce se poate ține în frâu e contractul dintre ele și restul
   aplicației: numele câmpurilor, câmpurile pe care N-au voie să le atingă,
   și semnalul `?nou=1` fără de care nu se aplică niciodată.
   ===================================================================== */

const SURSA_APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const SURSA_CORPS = fs.readFileSync(path.join(__dirname, '..', 'src', 'corps.js'), 'utf8');
const SURSA_ORD = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders.js'), 'utf8');
const EDIT_EJS = fs.readFileSync(path.join(__dirname, '..', 'views', 'corps', 'edit.ejs'), 'utf8');

/* Scoate lista GRUPE din app.js. Fișierul e pentru browser, nu se poate
   cere cu require(), așa că îi citim sursa. */
function grupeleDinApp() {
  const bloc = SURSA_APP.match(/var GRUPE = \[([\s\S]*?)\n\];/);
  assert.ok(bloc, 'nu mai există lista GRUPE în public/app.js');
  const grupe = [];
  bloc[1].split('\n').forEach(linie => {
    const id = linie.match(/id:\s*'([^']+)'/);
    if (!id) return;
    const camp = linie.match(/camp:\s*\[([^\]]*)\]/);
    assert.ok(camp, `grupa ${id[1]} n-are lista de câmpuri`);
    grupe.push({
      id: id[1],
      camp: (camp[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1))
    });
  });
  assert.ok(grupe.length >= 5, 'prea puține grupe de setări');
  return grupe;
}

test('fiecare câmp din setări există chiar în parametrii unui corp', () => {
  const p = defaults();
  grupeleDinApp().forEach(g => {
    g.camp.forEach(f => {
      assert.ok(Object.prototype.hasOwnProperty.call(p, f),
        `grupa „${g.id}" trimite spre câmpul «${f}», care nu există în defaults(); ` +
        'setarea s-ar scrie în gol, fără nicio eroare');
    });
  });
});

test('setările nu ating forma corpului, doar felul de-a lucra', () => {
  /* Un corp în L salvat ca „implicit" ar face orice corp nou să iasă în L.
     Forma vine din model sau din mâna omului, niciodată din setări. */
  const interzise = ['tip', 'contur', 'W2', 'orb', 'nume'];
  grupeleDinApp().forEach(g => {
    g.camp.forEach(f => {
      assert.ok(interzise.indexOf(f) === -1,
        `grupa „${g.id}" ar ține minte «${f}», care e forma corpului, nu o setare`);
    });
  });
});

test('fiecare grupă de setări are text în toate cele 30 de limbi', () => {
  const grupe = grupeleDinApp();
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    grupe.forEach(g => {
      const cheie = 'grup' + g.id.charAt(0).toUpperCase() + g.id.slice(1);
      assert.ok(dict.setari && dict.setari[cheie],
        `${f} n-are setari.${cheie}; în editor s-ar vedea cheia brută`);
    });
  });
});

test('corpurile proaspete primesc `nou=1`, copiile nu', () => {
  /* Fără semnalul ăsta setările nu se aplică niciodată, iar zona din editor
     rămâne o bifă fără efect. */
  assert.match(SURSA_CORPS, /res\.redirect\(`\/corps\/\$\{creeazaCorp\([\s\S]*?\}\?nou=1`\)/,
    'corpul creat în afara unei comenzi nu mai spune că e nou');
  assert.match(SURSA_ORD, /res\.redirect\(`\/corps\/\$\{corpId\}\?nou=1`\)/,
    'corpul adăugat într-o comandă nu mai spune că e nou');

  /* Copia pornește din corpul copiat; dacă ar primi `nou=1`, setările ar
     călca peste exact ce voia omul să copieze. */
  const copie = SURSA_CORPS.match(/dupliceazaCorp[\s\S]*?res\.redirect\([^)]*\)/);
  assert.ok(copie, 'nu mai găsesc ruta de duplicare');
  assert.ok(!/nou=1/.test(copie[0]), 'copia unui corp nu are voie să pornească din setări');
});

test('editorul primește `nou` și `matFixat`, altfel setările nu se pot aplica', () => {
  assert.match(EDIT_EJS, /nou:\s*nou/, 'page-data nu mai trimite `nou`');
  assert.match(EDIT_EJS, /matFixat:\s*matFixat/, 'page-data nu mai trimite `matFixat`');
  assert.match(SURSA_CORPS, /nou:\s*req\.query\.nou === '1'/, 'ruta nu mai calculează `nou`');
  assert.match(SURSA_CORPS, /matFixat:\s*!!corp\.mat_corp_id/, 'ruta nu mai calculează `matFixat`');
  assert.match(EDIT_EJS, /'editor',\s*'setari'/, 'pagina nu mai cere catalogul `setari`');
});

test('materialul comenzii bate setarea din browser', () => {
  /* Placa și cantul unui corp dintr-o comandă sunt ale comenzii. Dacă
     browserul ar călca peste ele, piesele ar ieși din altă placă decât
     cea cumpărată — și nimeni n-ar vedea de ce. */
  assert.match(SURSA_APP, /if \(g\.id === 'material' && DATA\.matFixat\) return;/,
    'aplicaSetari() nu mai ferește materialul comenzii');
});

test('spatele de PFL pornește de la 2.5, cum se lucrează în atelier', () => {
  assert.equal(defaults().tp, 2.5);
});

/* =====================================================================
   8. Cataloagele: româna e plasa de siguranță, nu locul unde se stă

   Testul vecin oprește cheile inventate. Ăsta oprește cheile lipsă: o
   cheie fără traducere cade pe română, deci nimic nu se strică — se vede
   doar românește într-o pagină turcească, și nimeni nu observă.
   ===================================================================== */

test('fiecare cheie din română are traducere în toate limbile', () => {
  const plat = (o, pre = '') => Object.keys(o).reduce((acc, k) => {
    const v = o[k], cale = pre ? pre + '.' + k : k;
    /* formele de plural sunt un obiect cu categorii, nu un subspațiu */
    if (v && typeof v === 'object' && !Array.isArray(v) &&
        !['zero', 'one', 'two', 'few', 'many', 'other'].some(c => c in v)) {
      return acc.concat(plat(v, cale));
    }
    return acc.concat([cale]);
  }, []);

  const adanc = (o, cale) => cale.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const ro = JSON.parse(fs.readFileSync(path.join(LOCALES, 'ro.json'), 'utf8'));
  const chei = plat(ro);

  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json') && f !== 'ro.json').forEach(f => {
    const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    const lipsa = chei.filter(k => adanc(dict, k) === undefined);
    assert.deepEqual(lipsa, [], `${f} n-are: ${lipsa.slice(0, 8).join(', ')}` +
      (lipsa.length > 8 ? ` (+${lipsa.length - 8})` : ''));
  });
});
