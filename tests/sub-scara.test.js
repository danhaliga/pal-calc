'use strict';
/* Corpul de sub scară, din trei cote.

   Până acum omul trebuia să dea patru laturi ȘI patru unghiuri — adică să
   socotească singur panta și cele două unghiuri, cu Pitagora și cu
   arctangenta. Un producător de mobilă are sub ochi altceva: lățimea de jos
   și cele două înălțimi.

   Aici stă și paza unei erori care venea din unghiurile rotunjite la grad:
   conturul rămânea cu 0.2 mm în colț, muchia din stânga ieșea din
   dreptunghiul de gabarit, iar lista CNC cerea o frezare pe o latură dreaptă. */

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

/* baza, înălțimea din dreapta, înălțimea din stânga */
const COTE = [
  [900, 400, 800],      /* scara coboară spre dreapta — cazul obișnuit */
  [900, 800, 400],      /* invers, scara coboară spre stânga */
  [1200, 300, 2100],    /* pantă abruptă */
  [600, 500, 520],      /* pantă abia simțită */
  [800, 700, 700],      /* deloc: iese un dreptunghi */
  [450, 1000, 120],     /* mai înalt decât lat */
  [3000, 60, 2400]
];

/* ---------------- geometria ---------------- */

test('conturul se închide exact, la orice potrivire de cote', () => {
  /* „Aproape închis" nu e închis: 0.2 mm în colț mută muchia din stânga
     afară din dreptunghiul de gabarit, iar de acolo iese o frezare cerută
     degeaba. */
  COTE.forEach(([x, y, z]) => {
    const g = PalCalc.conturGeometrie(PalCalc.conturSubScara(x, y, z));
    const ultim = g.puncte[g.puncte.length - 1];
    const gresit = Math.hypot(ultim[0] - 0, ultim[1] - z);
    assert.ok(gresit < 0.05,
      x + '/' + y + '/' + z + ': rămâne ' + gresit.toFixed(3) + ' mm în colț');
    assert.equal(g.W, x, x + '/' + y + '/' + z + ': gabaritul pe lățime');
    assert.equal(g.H, Math.max(y, z), x + '/' + y + '/' + z + ': gabaritul pe înălțime');
  });
});

test('colțurile ies unde trebuie: jos drept, sus pe pantă', () => {
  COTE.forEach(([x, y, z]) => {
    const p = PalCalc.conturGeometrie(PalCalc.conturSubScara(x, y, z)).puncte;
    const aproape = (a, b, ce) => assert.ok(Math.abs(a - b) < 0.05,
      x + '/' + y + '/' + z + ': ' + ce + ' — ' + a + ' în loc de ' + b);
    aproape(p[0][0], 0, 'colțul din stânga jos, pe x');
    aproape(p[0][1], 0, 'colțul din stânga jos, pe y');
    aproape(p[1][0], x, 'colțul din dreapta jos');
    aproape(p[2][0], x, 'colțul din dreapta sus, pe x');
    aproape(p[2][1], y, 'înălțimea din dreapta');
    aproape(p[3][0], 0, 'colțul din stânga sus, pe x');
    aproape(p[3][1], z, 'înălțimea din stânga');
  });
});

test('unghiurile sunt cele ale pantei, nu niște cifre rotunjite', () => {
  COTE.forEach(([x, y, z]) => {
    const c = PalCalc.conturSubScara(x, y, z);
    const alfa = Math.atan2(z - y, x) * 180 / Math.PI;
    assert.ok(Math.abs(c[1].unghi - (90 + alfa)) < 0.01,
      x + '/' + y + '/' + z + ': colțul de sus din dreapta');
    assert.ok(Math.abs(c[2].unghi - (90 - alfa)) < 0.01,
      x + '/' + y + '/' + z + ': colțul de sus din stânga');
    assert.equal(c[0].unghi, 90, 'colțul din stânga jos nu mai e drept');
    assert.equal(c[3].unghi, 90, 'colțul din dreapta jos nu mai e drept');
    /* suma unghiurilor unui patrulater */
    const suma = c.reduce((s, l) => s + l.unghi, 0);
    assert.ok(Math.abs(suma - 360) < 0.01, 'unghiurile nu fac 360: ' + suma);
  });
});

test('panta e ipotenuza, nu o cotă ghicită', () => {
  COTE.forEach(([x, y, z]) => {
    const c = PalCalc.conturSubScara(x, y, z);
    assert.ok(Math.abs(c[2].lung - Math.hypot(x, z - y)) < 0.05,
      x + '/' + y + '/' + z + ': panta a ieșit ' + c[2].lung);
  });
});

test('cu cele două înălțimi egale iese un dreptunghi curat', () => {
  const c = PalCalc.conturSubScara(800, 700, 700);
  assert.deepEqual(c.map(l => l.unghi), [90, 90, 90, 90]);
  assert.deepEqual(c.map(l => l.lung), [800, 700, 800, 700]);
});

test('merge și invers, cu scara coborând spre stânga', () => {
  const dr = PalCalc.conturSubScara(900, 400, 800);   /* înalt în stânga */
  const st = PalCalc.conturSubScara(900, 800, 400);   /* înalt în dreapta */
  assert.equal(dr[2].lung, st[2].lung, 'panta ar trebui să iasă la fel');
  /* unghiurile se schimbă între ele */
  assert.ok(Math.abs(dr[1].unghi - st[2].unghi) < 0.01);
  assert.ok(Math.abs(dr[2].unghi - st[1].unghi) < 0.01);
});

test('cotele se citesc înapoi din contur', () => {
  /* De asta atârnă casetele din editor: se umplu din corpul deschis, ca omul
     să vadă de la ce pleacă. */
  COTE.forEach(([x, y, z]) => {
    const c = PalCalc.coteSubScara(PalCalc.conturSubScara(x, y, z));
    assert.ok(c, x + '/' + y + '/' + z + ': nu se recunoaște');
    assert.deepEqual([c.baza, c.dreapta, c.stanga], [x, y, z]);
  });
});

test('ce nu e corp sub scară nu se dă drept unul', () => {
  const nu = [
    null, [], PalCalc.conturImplicit(800, 720).slice(0, 3),
    /* cinci laturi */
    PalCalc.conturSubScara(900, 400, 800).concat([{ lung: 100, unghi: 90 }]),
    /* latura de jos înclinată */
    [{ lung: 900, unghi: 80 }, { lung: 400, unghi: 100 },
     { lung: 900, unghi: 100 }, { lung: 400, unghi: 80 }]
  ];
  nu.forEach((c, i) => assert.equal(PalCalc.coteSubScara(c), null, 'cazul ' + i));
  /* dar un dreptunghi CHIAR e un corp sub scară cu panta zero */
  assert.ok(PalCalc.coteSubScara(PalCalc.conturImplicit(800, 720)));
});

/* ---------------- ce iese la tăiat ---------------- */

const subScara = () => PalModels.paramsFor('atipic-sub-scara', T);

test('modelul din catalog folosește conturul socotit, nu unul scris de mână', () => {
  const g = PalCalc.conturGeometrie(subScara().contur);
  assert.deepEqual(g.puncte.map(p => p.map(Math.round)),
    [[0, 0], [900, 0], [900, 400], [0, 800]],
    'conturul modelului nu mai e exact');
  assert.equal(g.W, 900);
  assert.equal(g.H, 800);

  const m = citeste('shared', 'models.js');
  assert.match(m, /contur: PalCalc\.conturSubScara\(900, 400, 800\)/,
    'conturul modelului s-a întors la cifre scrise de mână');
  assert.ok(!/lung: 985, unghi: 66/.test(m), 'a rămas panta veche, rotunjită');
});

test('panoul înclinat se taie la unghiul pantei, la amândouă capetele', () => {
  const r = PalCalc.calc(subScara(), T);
  const panta = r.P.filter(p => /Panou 3|panou.*3/i.test(p.nume) || p.L > 980)[0];
  assert.ok(panta, 'nu găsesc panoul înclinat');
  assert.ok(Math.abs(panta.L - 984.9) < 0.1, 'panta a ieșit ' + panta.L);
  /* Îmbinarea la un colț de θ se taie la θ/2 pe fiecare piesă. Unghiurile
     stau în argumentele notei, nu în text: textul se compune la afișare, în
     limba paginii. */
  assert.equal(panta.notaCheie, 'taiereLaUnghi');
  const alfa = Math.atan2(800 - 400, 900) * 180 / Math.PI;
  assert.ok(Math.abs(+panta.notaArgs.a - (90 + alfa) / 2) < 0.1,
    'capătul dinspre dreapta: ' + panta.notaArgs.a);
  assert.ok(Math.abs(+panta.notaArgs.b - (90 - alfa) / 2) < 0.1,
    'capătul dinspre stânga: ' + panta.notaArgs.b);
});

test('lista CNC cere frezat NUMAI panta, nu și muchia dreaptă', () => {
  /* Asta era eroarea: cu conturul închis aproximativ, muchia din stânga
     ieșea cu 0.2 mm în afara dreptunghiului de gabarit, iar `muchiiFrontale`
     o socotea muchie de decupat. Ieșea o frezare de 800 mm cerută degeaba,
     pe o latură care se taie drept la panou. */
  const t = PalCalc.traducator(T);
  const p = subScara();
  const comanda = {
    id: 1, name: 'proba', materiale: [], formate: ['intreaga'],
    feronerie: { asamblare: 'minifix', balama: 'blum-clip', glisiere: 'bila', suspensii: false }
  };
  const r = PalRaport.raport(comanda,
    [{ id: 1, name: 'Sub scară', poz: 1, params: p, materiale: {} }],
    { t: t, effortMs: 30, adaosCant: 15 });

  const decupate = r.cnc.filter(x => x.muchii && x.muchii.length);
  assert.ok(decupate.length >= 2, 'spatele și frontul ar trebui decupate după contur');
  decupate.forEach(x => {
    assert.equal(x.muchii.length, 1,
      x.piesa + ': ' + x.muchii.length + ' muchii de frezat, ar trebui una singură — ' +
      x.muchii.map(m => m.lung).join(', '));
    assert.ok(Math.abs(x.muchii[0].lung - 984.9) < 0.2,
      x.piesa + ': muchia de frezat e ' + x.muchii[0].lung + ', nu panta');
  });
});

/* ---------------- unde se cere ---------------- */

test('editorul are cele trei casete și butonul', () => {
  const v = citeste('views', 'corps', 'edit.ejs');
  ['ssBaza', 'ssStanga', 'ssDreapta', 'ssFa'].forEach(i => {
    assert.ok(v.indexOf('id="' + i + '"') !== -1, 'lipsește ' + i);
  });
  assert.match(v, /editor\.subScaraTitlu/);

  const app = citeste('public', 'app.js');
  assert.match(app, /conturSubScara\(x, y, z\)/, 'butonul nu cheamă socoteala');
  assert.match(app, /function umpleSubScara/, 'casetele nu se umplu din corpul deschis');
  assert.match(app, /el === document\.activeElement/,
    'cifra ar sări sub mâna omului cât scrie în casetă');
});

test('cele opt chei sunt în toate cele treizeci de limbi', () => {
  const chei = ['editor.subScaraTitlu', 'editor.subScaraBaza', 'editor.subScaraStanga',
                'editor.subScaraDreapta', 'editor.subScaraFa', 'editor.subScaraNota',
                'editor.subScaraCote', 'editor.subScaraGata'];
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
    /* mesajul de la sfârșit duce trei cifre: panta și cele două unghiuri */
    ['{panta}', '{a}', '{b}'].forEach(x => {
      assert.ok(String(ia(c, 'editor.subScaraGata')).indexOf(x) !== -1,
        l.cod + ': s-a pierdut ' + x + ' din mesaj');
    });
  });
});
