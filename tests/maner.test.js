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
