'use strict';
/* Sertarele se pot așeza și jos, cu ușile deasupra.

   Aici stă și paza unei erori care tăia DOUĂ piese pentru același loc: la un
   corp cu nișă, înălțimea ușii de deasupra se măsura până în tavan, fără să
   scadă fronturile de sertar care stau tot acolo. Ieșeau două uși de 512 ȘI
   un front de 150 peste aceiași 150 de milimetri — și nimic nu spunea nimic. */

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

const corp = extra => Object.assign(PalCalc.defaults(T), {
  W: 800, H: 800, D: 500, constr: 'intre', soclu: 80, spate: 'nut',
  nUsi: 2, montaj: 'incastrat', nPol: 1, nSer: 1, hFront: 150, hCutie: 100
}, extra || {});

/* Fronturile, ca fâșii pe înălțime, de jos în sus. */
function fronturi(params) {
  const out = [];
  PalCalc.calc(params, T).P.forEach(p => (p.boxes || []).forEach(b => {
    if (b.grp === 'fronturi') {
      out.push({ cheie: p.cheie, x0: b.x, x1: b.x + b.sx,
                 jos: Math.round(b.y), sus: Math.round(b.y + b.sy) });
    }
  }));
  return out.sort((a, b) => a.jos - b.jos);
}

function suprapuneri(params) {
  const f = fronturi(params), rele = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = i + 1; j < f.length; j++) {
      const a = f[i], b = f[j];
      const peX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const peY = Math.min(b.sus, a.sus) - Math.max(a.jos, b.jos);
      if (peX > 1 && peY > 1) rele.push(a.cheie + '/' + b.cheie + ' pe ' + Math.round(peY) + ' mm');
    }
  }
  return rele;
}

/* ---------------- eroarea ---------------- */

test('la un corp cu nișă, ușa nu mai intră peste frontul de sertar', () => {
  /* Corpul lui Dan: 800 înălțime, soclu 80, gol de 150 jos, un sertar de 150.
     Ieșeau uși de la 268 la 780 ȘI un front de sertar de la 630 la 780. */
  const c = corp({ hNisa: 150, hUsi: '' });
  assert.deepEqual(suprapuneri(c), [], 'două piese tăiate pentru același loc');

  const f = fronturi(c);
  const usa = f.filter(x => x.cheie === 'usa')[0];
  const front = f.filter(x => x.cheie === 'frontSertar')[0];
  assert.ok(usa && front, 'lipsesc piesele din fața corpului');
  assert.ok(usa.sus <= front.jos, 'ușa urcă peste sertar: ' + JSON.stringify([usa, front]));
});

test('niciun front nu calcă peste altul, la nicio potrivire de nișă și sertare', () => {
  let n = 0;
  [0, 1].forEach(sertareJos => {
    [0, 1, 3].forEach(nSer => {
      [0, 2].forEach(nUsi => {
        ['', 300].forEach(hUsi => {
          [0, 150, 400].forEach(hNisa => {
            ['aplicat', 'incastrat'].forEach(montaj => {
              [0, 80].forEach(soclu => {
                const c = corp({ H: 2000, D: 560, sertareJos, nSer, nUsi, hUsi, hNisa, montaj, soclu });
                n++;
                assert.deepEqual(suprapuneri(c), [],
                  'sertareJos=' + sertareJos + ' nSer=' + nSer + ' nUsi=' + nUsi +
                  ' hUsi=' + hUsi + ' hNisa=' + hNisa + ' ' + montaj + ' soclu=' + soclu);
              });
            });
          });
        });
      });
    });
  });
  assert.ok(n >= 200, 's-au încercat prea puține potriviri: ' + n);
});

/* ---------------- sertarele jos ---------------- */

test('jos înseamnă jos: sertarele la fund, ușile deasupra', () => {
  const f = fronturi(corp({ sertareJos: 1, hNisa: 0, nSer: 2 }));
  const sertare = f.filter(x => x.cheie === 'frontSertar');
  const usi = f.filter(x => x.cheie === 'usa');
  assert.equal(sertare.length, 2);
  assert.ok(usi.length >= 1);
  assert.ok(Math.max.apply(null, sertare.map(x => x.sus)) <= Math.min.apply(null, usi.map(x => x.jos)),
    'ușile n-au ajuns deasupra sertarelor');
  /* Sertarul de jos se lipește de fundul feței, cum se lipește cel de sus de
     tavan când stau sus. */
  const susVariantaVeche = fronturi(corp({ hNisa: 0, nSer: 2 }));
  const susMax = Math.max.apply(null, susVariantaVeche.map(x => x.sus));
  const josMin = Math.min.apply(null, f.map(x => x.jos));
  assert.ok(Math.abs((susMax - susVariantaVeche.filter(x => x.cheie === 'frontSertar')
    .map(x => x.sus).sort((a, b) => b - a)[0])) < 0.01, 'sertarul de sus nu mai atinge tavanul');
  assert.equal(josMin, sertare.map(x => x.jos).sort((a, b) => a - b)[0],
    'sub sertarul de jos a rămas ceva');
});

test('interiorul și carcasa nu se schimbă când sertarele coboară', () => {
  /* Se mută numai fața corpului. Lateralele, fundul, blatul și spatele
     rămân cum erau — altfel „jos" ar însemna alt corp, nu altă față. */
  const sus = PalCalc.calc(corp({ hNisa: 0, nSer: 2 }), T);
  const jos = PalCalc.calc(corp({ hNisa: 0, nSer: 2, sertareJos: 1 }), T);
  const carcasa = r => r.P.filter(p => p.rol === 'corp' || p.rol === 'spate')
                          .map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(carcasa(jos), carcasa(sus));
  assert.deepEqual([jos.Wint, jos.Hint, jos.Dint], [sus.Wint, sus.Hint, sus.Dint]);

  /* Și piesele de sertar ies la fel: se mută, nu se schimbă. */
  const cutii = r => r.P.filter(p => p.rol === 'sertar' || p.cheie === 'frontSertar')
                        .map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(cutii(jos), cutii(sus));
});

test('ușile se scurtează la fel, din oricare capăt vin sertarele', () => {
  const inalt = sj => fronturi(corp({ hNisa: 0, nSer: 2, sertareJos: sj }))
    .filter(x => x.cheie === 'usa').map(x => x.sus - x.jos)[0];
  assert.equal(inalt(1), inalt(0), 'ușa iese de altă înălțime când sertarele stau jos');
});

test('fără sertare, semnul nu schimbă nimic', () => {
  const a = PalCalc.calc(corp({ nSer: 0, hNisa: 0 }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  const b = PalCalc.calc(corp({ nSer: 0, hNisa: 0, sertareJos: 1 }), T).P.map(p => [p.cheie, p.buc, p.TL, p.Tl]);
  assert.deepEqual(b, a);
  assert.equal(PalCalc.defaults().sertareJos, 0, 'sus nu mai e felul obișnuit');
});

test('polițele nu intră peste sertare, din niciun capăt', () => {
  const politele = sj => {
    const y = [];
    PalCalc.calc(corp({ hNisa: 0, nSer: 2, nPol: 2, sertareJos: sj }), T).P
      .forEach(p => (p.boxes || []).forEach(b => { if (b.grp === 'polite') y.push(b.y); }));
    return y.sort((a, b) => a - b);
  };
  const f = sj => fronturi(corp({ hNisa: 0, nSer: 2, nPol: 2, sertareJos: sj }))
    .filter(x => x.cheie === 'frontSertar');
  const jos = politele(1), sertareJos = f(1);
  assert.ok(jos.length, 'n-au ieșit polițe');
  assert.ok(Math.min.apply(null, jos) >= Math.max.apply(null, sertareJos.map(x => x.sus)) - 20,
    'o poliță a ajuns în dreptul unui sertar de jos');
});

/* ---------------- ce se spune ---------------- */

test('golul de jos rămas gol se spune, nu se trece cu vederea', () => {
  /* Omul a lăsat un gol jos și a pus un sertar: de cele mai multe ori golul
     era TOCMAI pentru sertar. Se poate și altfel — frigider dedesubt, sertar
     deasupra — deci e o vorbă, nu o oprire. */
  const c = corp({ hNisa: 150, hUsi: '' });
  const a = PalCalc.calc(c, T).avertismente.filter(x => x.cheie === 'sertareSusNisaJos')[0];
  assert.ok(a, 'nu se spune nimic');
  assert.equal(a.args.nisa, '150');

  const coborate = PalCalc.calc(Object.assign({}, c, { sertareJos: 1 }), T);
  assert.ok(!coborate.avertismente.some(x => x.cheie === 'sertareSusNisaJos'),
    'se plânge și după ce omul a făcut ce i s-a spus');
});

test('nu se spune nimic când n-are de ce', () => {
  [{ hNisa: 0 }, { nSer: 0, hNisa: 150 }, { hNisa: 300, hUsi: 300 }].forEach(x => {
    const r = PalCalc.calc(corp(x), T);
    assert.ok(!r.avertismente.some(a => a.cheie === 'sertareSusNisaJos'),
      'se plânge degeaba la ' + JSON.stringify(x));
  });
});

test('schema primește doar 0 sau 1', () => {
  const schema = PalCalc.paramsSchema;
  if (!schema) return;
  const da = v => schema.parse(corp({ sertareJos: v })).sertareJos;
  assert.equal(da(1), 1);
  assert.equal(da('1'), 1);
  assert.equal(da(0), 0);
  assert.equal(da(9), 0);
  assert.equal(da('aiurea'), 0);
});

/* ---------------- ce se vede ---------------- */

test('desenul mută sertarele odată cu ele', () => {
  const y = sj => (PalModels.sketch(Object.assign(PalModels.paramsFor('baza-4sertare', T),
    { nUsi: 1, nSer: 2, nPol: 1, sertareJos: sj })).match(/<rect[^>]*class="sk-front"[^>]*\/>/g) || [])
    .map(r => +(r.match(/y="([\d.]+)"/) || [])[1]);
  const sus = y(0), jos = y(1);
  assert.equal(sus.length, 3);
  assert.equal(jos.length, 3);
  /* SVG are y în jos: sertarele jos înseamnă y mare. */
  assert.ok(Math.min.apply(null, jos) < Math.min.apply(null, sus.slice(2)) + 1,
    'ușa n-a urcat în desen');
  assert.ok(Math.max.apply(null, jos) > Math.max.apply(null, sus),
    'sertarele n-au coborât în desen');
});

test('cardul scrie unde stau sertarele', () => {
  PalI18n.inregistreaza('ro', JSON.parse(citeste('locales', 'ro.json')));
  const t = PalI18n.creeaza('ro');
  const p = PalModels.paramsFor('baza-4sertare', T);
  assert.match(PalModels.rezumat(Object.assign({}, p, { sertareJos: 1 }), t), /sertare jos/);
  assert.ok(!/sertare jos/.test(PalModels.rezumat(p, t)), 'scrie și la unul cu sertarele sus');
  assert.ok(!/sertare jos/.test(PalModels.rezumat(
    Object.assign({}, p, { sertareJos: 1, nSer: 0 }), t)),
    'scrie „sertare jos" la un corp fără sertare');
});

test('se cere din editor', () => {
  const vedere = citeste('views', 'corps', 'edit.ejs');
  assert.match(vedere, /id="sertareJos"/);
  assert.match(vedere, /editor\.sertareSus[\s\S]*editor\.sertareJos/, 'sus trebuie să fie prima');
  assert.match(citeste('public', 'app.js'), /'nSer','sertareJos'/,
    'editorul nu trimite semnul la calcul');
});

test('cele cinci chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['editor.pozitieSertare', 'editor.sertareSus', 'editor.sertareJos',
                'avert.sertareSusNisaJos', 'rezumat.sertareJos'];
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
    assert.match(String(ia(c, 'avert.sertareSusNisaJos')), /\{nisa\}/,
      l.cod + ': s-a pierdut cota golului');
  });
});
