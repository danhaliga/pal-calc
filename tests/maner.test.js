'use strict';
/* Mânerul: se pune sau nu, orizontal sau vertical, și unde pe front.

   „Nu se pune" nu e o toană: la push-to-open, la profil gola sau la o
   prindere frezată în front chiar nu intră niciun mâner în comandă. Iar cele
   două alegeri nu se pot bate cap în cap — fiecare poziție lucrează pe axa
   ei, deci toate zece potrivirile înseamnă ceva. */

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

const corp = extra => Object.assign(PalModels.paramsFor('baza-2usi', T),
  { nUsi: 2, nSer: 1, hFront: 150 }, extra || {});

/* Liniile de mâner din desen, ca segmente. */
function manere(params) {
  return (PalModels.sketch(params).match(/<line[^>]*class="sk-maner"[^>]*\/>/g) || []).map(l => {
    const g = a => +(l.match(new RegExp(a + '="([-\\d.]+)"')) || [])[1];
    const x1 = g('x1'), y1 = g('y1'), x2 = g('x2'), y2 = g('y2');
    return { x1, y1, x2, y2,
             vertical: Math.abs(x1 - x2) < 0.01,
             cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  });
}

/* ---------------- se pune sau nu ---------------- */

test('implicit se pune, și arată exact ca înainte', () => {
  /* Ușa: vertical, pe muchia dinspre mijlocul corpului. Frontul de sertar:
     orizontal, la mijloc. Ăsta era desenul dintotdeauna și n-are voie să se
     miște numai fiindcă acum e o casetă pentru el. */
  assert.equal(PalCalc.defaults().maner, 1);
  assert.equal(PalCalc.defaults().manerDir, 'obisnuit');
  assert.equal(PalCalc.defaults().manerPoz, 'obisnuit');

  const m = manere(corp());
  assert.equal(m.length, 3, 'două uși și un sertar, deci trei mânere');
  const sertar = m.filter(x => !x.vertical);
  const usi = m.filter(x => x.vertical);
  assert.equal(sertar.length, 1, 'frontul de sertar nu mai are mâner orizontal');
  assert.equal(usi.length, 2, 'ușile nu mai au mâner vertical');
  /* Cele două uși și le țin pe muchiile dinspre mijloc, deci aproape una de
     alta — nu pe la capetele corpului. */
  const dist = Math.abs(usi[0].cx - usi[1].cx);
  assert.ok(dist < corp().W / 2, 'mânerele ușilor au fugit spre margini: ' + dist);
});

test('nebifat: niciun mâner desenat și niciunul cumpărat', () => {
  assert.deepEqual(manere(corp({ maner: 0 })), []);

  const cu = feronerie(corp());
  const fara = feronerie(corp({ maner: 0 }));
  const aleManerului = Object.keys(cu).filter(k => /maner/i.test(k));
  assert.ok(aleManerului.length >= 2, 'nu găsesc mânerul și șuruburile lui în listă');
  aleManerului.forEach(k => assert.ok(!fara[k], 'a rămas ' + k + ' în listă'));
  /* Restul feroneriei nu se clintește: mânerul nu ține corpul. */
  Object.keys(cu).filter(k => !/maner/i.test(k))
    .forEach(k => assert.equal(fara[k], cu[k], 's-a schimbat ' + k));
});

function feronerie(params) {
  const t = PalCalc.traducator(T);
  return PalRaport.feronerie(params, PalCalc.calc(params, t), null, t)
    .reduce((o, x) => { o[x.nume] = x.qty; return o; }, {});
}

test('fără fronturi nu există mâner, oricât ar fi bifat', () => {
  assert.deepEqual(manere(corp({ faraFront: 1, maner: 1 })), [],
    'un mâner care plutește în gol');
});

/* ---------------- cum se pune ---------------- */

test('orizontal înseamnă orizontal, pe toate fronturile', () => {
  const m = manere(corp({ manerDir: 'orizontal' }));
  assert.equal(m.length, 3);
  assert.ok(m.every(x => !x.vertical), 'a rămas vreunul vertical');
});

test('vertical înseamnă vertical, pe toate fronturile', () => {
  const m = manere(corp({ manerDir: 'vertical' }));
  assert.equal(m.length, 3);
  assert.ok(m.every(x => x.vertical), 'a rămas vreunul orizontal');
});

/* ---------------- unde pe front ---------------- */

test('stânga, dreapta și mijlocul mută mânerul pe lățime', () => {
  const cx = poz => manere(corp({ manerDir: 'vertical', manerPoz: poz }))
    .filter(x => x.vertical).map(x => x.cx);
  const st = cx('stanga'), dr = cx('dreapta'), ce = cx('centru');
  assert.equal(st.length, 3);
  for (let i = 0; i < st.length; i++) {
    assert.ok(st[i] < ce[i], 'stânga n-a ieșit la stânga de mijloc');
    assert.ok(ce[i] < dr[i], 'dreapta n-a ieșit la dreapta de mijloc');
  }
});

test('sus și jos mută mânerul pe înălțime', () => {
  const cy = poz => manere(corp({ manerDir: 'orizontal', manerPoz: poz })).map(x => x.cy);
  const sus = cy('sus'), jos = cy('jos'), ce = cy('centru');
  for (let i = 0; i < sus.length; i++) {
    /* SVG are y în jos: „sus" înseamnă y mic. */
    assert.ok(sus[i] < ce[i], 'sus n-a urcat');
    assert.ok(ce[i] < jos[i], 'jos n-a coborât');
  }
});

test('nicio potrivire nu rămâne fără înțeles', () => {
  /* Un mâner vertical pus „sus" rămâne vertical și urcă; unul orizontal pus
     „stânga" rămâne orizontal și se mută spre stânga. Zece potriviri, zece
     mânere desenate, niciunul ieșit din front. */
  let n = 0;
  ['obisnuit', 'orizontal', 'vertical'].forEach(dir => {
    ['obisnuit', 'centru', 'stanga', 'dreapta', 'sus', 'jos'].forEach(poz => {
      const p = corp({ manerDir: dir, manerPoz: poz });
      const m = manere(p); n++;
      assert.equal(m.length, 3, dir + '/' + poz + ': n-au ieșit toate mânerele');
      if (dir !== 'obisnuit') {
        const vrut = dir === 'vertical';
        assert.ok(m.every(x => x.vertical === vrut), dir + '/' + poz + ': direcție greșită');
      }
      m.forEach(x => {
        assert.ok(x.x1 >= 0 && x.x2 <= +p.W, dir + '/' + poz + ': mâner ieșit pe lățime');
        assert.ok(x.y1 >= 0 && x.y2 <= +p.H, dir + '/' + poz + ': mâner ieșit pe înălțime');
      });
    });
  });
  assert.equal(n, 18);
});

test('mânerul nu schimbă nicio cotă de tăiat', () => {
  /* E feronerie, nu PAL: se prinde în front, nu-l face mai mare sau mai mic. */
  const baza = PalCalc.calc(corp(), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  [{ maner: 0 }, { manerDir: 'orizontal' }, { manerPoz: 'sus' },
   { manerDir: 'vertical', manerPoz: 'jos' }].forEach(x => {
    assert.deepEqual(PalCalc.calc(corp(x), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]), baza,
      's-au mișcat cotele la ' + JSON.stringify(x));
  });
});

/* ---------------- validarea ---------------- */

test('schema nu lasă valori inventate', () => {
  const schema = PalCalc.paramsSchema;
  if (!schema) return;
  const da = x => schema.parse(corp(x));
  assert.equal(da({ maner: 0 }).maner, 0);
  assert.equal(da({ maner: 7 }).maner, 1, 'orice altceva înseamnă că se pune');
  assert.equal(da({ manerDir: 'pe diagonala' }).manerDir, 'obisnuit');
  assert.equal(da({ manerPoz: 'aiurea' }).manerPoz, 'obisnuit');
  assert.equal(da({ manerDir: 'orizontal', manerPoz: 'jos' }).manerPoz, 'jos');
});

/* ---------------- ce se vede și unde se cere ---------------- */

test('cardul scrie numai lipsa mânerului', () => {
  PalI18n.inregistreaza('ro', JSON.parse(citeste('locales', 'ro.json')));
  const t = PalI18n.creeaza('ro');
  assert.match(PalModels.rezumat(corp({ maner: 0 }), t), /fără mâner/);
  assert.ok(!/mâner/.test(PalModels.rezumat(corp(), t)),
    'scrie de mâner și la unul obișnuit — ar fi zgomot pe fiecare card');
  assert.ok(!/mâner/.test(PalModels.rezumat(corp({ maner: 0, nUsi: 0, nSer: 0 }), t)),
    'scrie „fără mâner" la un corp deschis, care n-are pe ce-l pune');
});

test('se cere din editor, iar bifa ascunde ce n-are rost', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /id="maner" type="checkbox"/);
  assert.match(vedere, /id="manerDir"/);
  assert.match(vedere, /id="manerPoz"/);
  ['manerOrizontal', 'manerVertical', 'manerCentru', 'manerStanga',
   'manerDreapta', 'manerSus', 'manerJos'].forEach(k => {
    assert.ok(vedere.indexOf("editor." + k) !== -1, 'lipsește varianta ' + k);
  });

  const app = citeste('public', 'app.js');
  assert.match(app, /'maner','manerDir','manerPoz'/, 'editorul nu le trimite la calcul');
  assert.match(app, /arata\('randManer', !!\+params\.maner\)/,
    'cum și unde rămân pe ecran când mânerul nu se pune');
});

test('o bifă se citește din `checked`, nu din `value`', () => {
  /* `value` pe o bifă e „on", care nu înseamnă nimic pentru calcul; iar la
     desenare trebuie pus `checked`, nu `value`, altfel caseta rămâne goală
     pe un corp deschis a doua oară. */
  const app = citeste('public', 'app.js');
  assert.match(app, /type === 'checkbox'\s*\n?\s*\? \(e\.target\.checked \? 1 : 0\)/);
  assert.match(app, /\$\(f\)\.type === 'checkbox'\) \{ \$\(f\)\.checked = !!\+v; return; \}/);
});

test('cele paisprezece chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['editor.legManer', 'editor.sePuneManer', 'editor.notaManer',
                'editor.manerCum', 'editor.manerUnde', 'editor.manerObisnuit',
                'editor.manerOrizontal', 'editor.manerVertical', 'editor.manerCentru',
                'editor.manerStanga', 'editor.manerDreapta', 'editor.manerSus',
                'editor.manerJos', 'rezumat.faraManer'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipsește ' + k);
    });
    /* Direcțiile și locurile nu se pot numi la fel: omul alege dintr-o listă
       și trebuie să le poată deosebi. */
    const variante = ['manerOrizontal', 'manerVertical'].map(k => ia(c, 'editor.' + k));
    assert.equal(new Set(variante).size, 2, l.cod + ': orizontal și vertical se cheamă la fel');
    const locuri = ['manerCentru', 'manerStanga', 'manerDreapta', 'manerSus', 'manerJos']
      .map(k => ia(c, 'editor.' + k));
    assert.equal(new Set(locuri).size, 5, l.cod + ': două locuri se cheamă la fel');
  });
});

/* ---------------- lungimea, si bara din vederea 3D ---------------- */

test('lungimea se ia in milimetri, nu din ochi', () => {
  const lung = L => manere(corp({ manerL: L })).map(x =>
    Math.round(Math.max(Math.abs(x.x2 - x.x1), Math.abs(x.y2 - x.y1))));
  assert.equal(PalCalc.defaults().manerL, 128, '128 nu mai e marimea obisnuita');
  [96, 128, 224].forEach(L => {
    lung(L).forEach(l => assert.ok(Math.abs(l - L) <= 1 || l < L,
      'la ' + L + ' mm a iesit ' + l));
  });
  /* Pe un front scurt se scurteaza singur, nu iese din piesa. */
  assert.ok(Math.max.apply(null, lung(2000)) < 900, 'un maner de 2000 a ramas de 2000');
});

test('gol inseamna „cat incape", ca inainte de caseta asta', () => {
  const l = manere(corp({ manerL: 0 })).map(x =>
    Math.max(Math.abs(x.x2 - x.x1), Math.abs(x.y2 - x.y1)));
  assert.ok(l.every(x => x > 0), 'cu 0 nu se mai deseneaza niciun maner');
  assert.ok(new Set(l.map(Math.round)).size > 1,
    'toate au iesit de aceeasi lungime, deci nu se mai masoara din front');
  assert.match(citeste('public', 'app.js'), /'lg', 'manerL'\]/,
    'caseta nu arata goala cand e 0, si nimeni nu ghiceste ce inseamna');
});

test('manerul nu iese niciodata din front', () => {
  /* Un maner de 128 pus „sus" pe un front de sertar de 150 ii iesea in sus cu
     25 de milimetri: atarna in aer deasupra piesei. Se trage inapoi inauntru. */
  let n = 0;
  ['obisnuit', 'orizontal', 'vertical'].forEach(dir => {
    ['obisnuit', 'centru', 'stanga', 'dreapta', 'sus', 'jos'].forEach(poz => {
      [0, 96, 128, 320, 1200].forEach(L => {
        [[797, 150], [398, 565], [300, 2000], [1200, 120], [120, 120]].forEach(([lat, inalt]) => {
          ['vertical', 'orizontal'].forEach(imp => {
            const a = PalCalc.asezareManer(corp({ manerDir: dir, manerPoz: poz, manerL: L }),
                                           lat, inalt, imp, true);
            n++;
            if (!a) return;
            const jx = a.vertical ? 0 : a.lung / 2, jy = a.vertical ? a.lung / 2 : 0;
            const unde = dir + '/' + poz + ' L=' + L + ' front ' + lat + '×' + inalt;
            assert.ok(a.fx * lat - jx >= -0.01, unde + ': iese pe stanga');
            assert.ok(a.fx * lat + jx <= lat + 0.01, unde + ': iese pe dreapta');
            assert.ok(a.fy * inalt - jy >= -0.01, unde + ': iese pe jos');
            assert.ok(a.fy * inalt + jy <= inalt + 0.01, unde + ': iese pe sus');
          });
        });
      });
    });
  });
  assert.ok(n >= 900, 'prea putine potriviri incercate: ' + n);
});

test('frontul de sertar isi tine manerul la mijloc, si intors pe verticala', () => {
  /* O bara verticala lipita de muchia unui sertar lat de 800 n-a pus-o nimeni
     niciodata. Muchia dinspre mijlocul corpului e treaba usilor. */
  const p = corp({ manerDir: 'vertical' });
  assert.equal(PalCalc.asezareManer(p, 797, 150, 'orizontal', false).fx, 0.5);
  assert.equal(PalCalc.asezareManer(p, 398, 565, 'vertical', false).fx, 0.12);
});

test('bara intra in vederea 3D, cu grupa ei', () => {
  /* Nu e piesa de taiat, deci nu are rand in lista: sta deoparte, in
     `manere`, ca sa se poata stinge singura din vedere. */
  const r = PalCalc.calc(corp({ manerL: 160 }), T);
  assert.equal(r.manere.length, 3, 'doua usi si un sertar, deci trei bare');
  r.manere.forEach(b => {
    assert.equal(b.grp, 'manere', 'bara a ajuns in alta grupa');
    assert.equal(Math.round(Math.max(b.sx, b.sy)), 160, 'bara nu are lungimea ceruta');
    assert.ok(b.sz > 0, 'bara nu iese din front');
  });
  assert.ok(!r.P.some(p => (p.boxes || []).some(b => b.grp === 'manere')),
    'o bara a intrat intre piesele de taiat');
  assert.deepEqual(PalCalc.calc(corp({ maner: 0 }), T).manere, []);

  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /class="vis" data-g="manere"/, 'nu se poate stinge din vedere');
  const app = citeste('public', 'app.js');
  assert.match(app, /res\.manere \|\| \[\]/, 'vederea 3D nu deseneaza barele');
  assert.match(app, /if \(mesh && !mesh\.userData\.p\) mesh = null;/,
    'apasarea pe o bara ar cauta un rand care nu exista');
});

test('schita si vederea 3D folosesc ACEEASI regula', () => {
  /* Doua socoteli ar fi mers in ritmuri diferite, iar desenul de pe card ar
     fi ajuns sa nu mai fie corpul din editor. */
  const m = citeste('shared', 'models.js');
  assert.match(m, /PalCalc\.asezareManer\(/, 'schita si-a facut socoteala ei');
  assert.ok(!/MARGINE_MANER/.test(m), 'a ramas o a doua regula in models.js');
});
