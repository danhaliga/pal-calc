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

test('panoul înclinat se taie la unghiul pantei, la amândouă capetele (rama în unghi)', () => {
  const r = PalCalc.calc(Object.assign(subScara(), { imbinare: 'unghi' }), T);
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
  assert.ok(decupate.length >= 2, 'spatele și ușa ar trebui decupate după contur');
  /* Fiecare piesă decupată are o singură muchie de frezat: bucata ei de pantă.
     Spatele o ia pe toată; o ușă doar cât ține compartimentul ei. Ce NU are
     voie să apară e o a doua muchie — aia ar fi o latură dreaptă, cerută la
     frezat degeaba, și exact asta se întâmpla cu conturul strâmb. */
  decupate.forEach(x => {
    assert.equal(x.muchii.length, 1,
      x.piesa + ': ' + x.muchii.length + ' muchii de frezat, ar trebui una singură — ' +
      x.muchii.map(m => m.lung).join(', '));
    assert.ok(x.muchii[0].lung > 100 && x.muchii[0].lung <= 984.9 + 0.2,
      x.piesa + ': muchia de frezat e ' + x.muchii[0].lung + ', nu o bucată de pantă');
  });
  /* spatele o ia pe toată */
  const spate = decupate.filter(x => /spate/i.test(x.piesa))[0];
  assert.ok(spate && Math.abs(spate.muchii[0].lung - 984.9) < 0.2,
    'spatele nu mai are panta întreagă');
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

/* ---------------- conturul scris din colturi ---------------- */

test('din colțuri ies laturile și unghiurile, exact', () => {
  /* Un corp atipic se desenează pe hârtie ca o listă de colțuri. Socoteala se
     întoarce: din colțuri ies lungimile și unghiurile, iar conturul se închide
     fiindcă n-are de unde să nu se închidă. */
  const forme = [
    ['dreptunghi', [[0, 0], [800, 0], [800, 720], [0, 720]]],
    ['sub scară',  [[0, 0], [900, 0], [900, 400], [0, 800]]],
    ['mansardă',   [[0, 0], [1200, 0], [1200, 700], [800, 1100], [0, 1100]]]
  ];
  forme.forEach(([nume, puncte]) => {
    const g = PalCalc.conturGeometrie(PalCalc.conturDinPuncte(puncte));
    assert.equal(g.puncte.length, puncte.length, nume + ': alt număr de colțuri');
    puncte.forEach((q, i) => {
      assert.ok(Math.abs(g.puncte[i][0] - q[0]) < 0.05 &&
                Math.abs(g.puncte[i][1] - q[1]) < 0.05,
        nume + ': colțul ' + (i + 1) + ' a ieșit ' + JSON.stringify(g.puncte[i]) +
        ' în loc de ' + JSON.stringify(q));
    });
  });
});

test('din colțuri iese același lucru ca din cele trei cote', () => {
  COTE.forEach(([x, y, z]) => {
    const a = PalCalc.conturSubScara(x, y, z);
    const b = PalCalc.conturDinPuncte([[0, 0], [x, 0], [x, y], [0, z]]);
    a.forEach((l, i) => {
      assert.ok(Math.abs(l.lung - b[i].lung) < 0.05, x + '/' + y + '/' + z + ': latura ' + i);
      assert.ok(Math.abs(l.unghi - b[i].unghi) < 0.01, x + '/' + y + '/' + z + ': unghiul ' + i);
    });
  });
});

test('mai puțin de trei colțuri nu e contur', () => {
  [[], [[0, 0]], [[0, 0], [100, 0]], null].forEach(p => {
    assert.deepEqual(PalCalc.conturDinPuncte(p), []);
  });
});

test('niciun model atipic nu mai are contur strâmb', () => {
  /* Gabaritul iese rotund numai daca laturile drepte chiar sunt drepte.
     Scrise de mana, cu unghiurile rotunjite la grad, ramaneau doua zecimi in
     colt: 1200.2 x 1100.2 in loc de 1200 x 1100. */
  /* cu tot cu cele devenite configurări rapide în editor */
  const atipice = PalModels.MODELS.filter(m => !m.ascuns || m.rapid)
    .map(m => m.id)
    .filter(id => PalModels.paramsFor(id, T).tip === 'atipic');
  assert.ok(atipice.length >= 3, 'nu mai sunt modele atipice');
  atipice.forEach(id => {
    const g = PalCalc.conturGeometrie(PalModels.paramsFor(id, T).contur);
    assert.equal(g.W, Math.round(g.W), id + ': gabaritul pe lățime e ' + g.W);
    assert.equal(g.H, Math.round(g.H), id + ': gabaritul pe înălțime e ' + g.H);
  });

  const m = citeste('shared', 'models.js');
  assert.match(m, /contur: PalCalc\.conturDinPuncte\(/, 'mansarda nu mai e scrisa din colturi');
  assert.ok(!/lung: 566, unghi: 135/.test(m), 'a ramas panta rotunjita a mansardei');
});

test('nu se cere frezat pe nicio latură dreaptă, la niciun corp atipic', () => {
  /* Muchia de frezat e cea care NU sta pe conturul dreptunghiului de gabarit.
     Cu conturul strâmb, o latura dreapta iesea cu doua zecimi in afara si era
     socotita muchie de decupat: o frezare de 800 sau 1100 mm ceruta degeaba. */
  const t = PalCalc.traducator(T);
  const comanda = {
    id: 1, name: 'proba', materiale: [], formate: ['intreaga'],
    feronerie: { asamblare: 'minifix', balama: 'blum-clip', glisiere: 'bila', suspensii: false }
  };
  PalModels.modele(T).map(x => x.id)
    .filter(id => PalModels.paramsFor(id, T).tip === 'atipic')
    .forEach(id => {
      const p = PalModels.paramsFor(id, T);
      const r = PalRaport.raport(comanda,
        [{ id: 1, name: id, poz: 1, params: p, materiale: {} }],
        { t: t, effortMs: 30, adaosCant: 15 });
      const g = PalCalc.conturGeometrie(p.contur);
      /* laturile inclinate: alea cu amandoua capetele in afara marginilor */
      const inclinate = g.laturi.filter(l =>
        Math.abs(l.de_la[0] - l.la[0]) > 0.5 && Math.abs(l.de_la[1] - l.la[1]) > 0.5);
      r.cnc.filter(x => x.muchii && x.muchii.length).forEach(x => {
        assert.equal(x.muchii.length, inclinate.length,
          id + ' / ' + x.piesa + ': ' + x.muchii.length + ' muchii de frezat, dar numai ' +
          inclinate.length + ' laturi sunt inclinate — ' + x.muchii.map(e => e.lung).join(', '));
      });
    });
});

/* ---------------- tabelul de laturi sta strans ---------------- */

test('cotele vin primele, tabelul sta strâns', () => {
  /* Cine face un corp sub scara are sub ochi latimea de jos si cele doua
     inaltimi. Tabelul de laturi si unghiuri ramane insa: mansarda are cinci
     laturi si nu se poate scrie din trei cote. */
  const v = citeste('views', 'corps', 'edit.ejs');
  const cote = v.indexOf('class="sub-scara"');
  const tabel = v.indexOf('id="conturManual"');
  assert.ok(cote !== -1 && tabel !== -1, 'lipsește una din cele două');
  assert.ok(cote < tabel, 'tabelul a ajuns înaintea cotelor');
  assert.match(v, /<details class="contur-manual" id="conturManual">/,
    'tabelul nu mai e strâns');
  assert.ok(!/<details[^>]*id="conturManual"[^>]*\sopen/.test(v),
    'tabelul se deschide singur la orice corp');
  /* tabelul si butoanele lui chiar sunt inauntru */
  const inauntru = v.slice(tabel, v.indexOf('</details>', tabel));
  ['conturTabel', 'conturAdauga', 'conturInchide', 'conturReset'].forEach(i => {
    assert.ok(inauntru.indexOf(i) !== -1, i + ' a rămas afară din panoul strâns');
  });

  const css = citeste('public', 'styles.css');
  assert.match(css, /\.contur-manual > summary\{/, 'panoul strâns n-are stil');
});

test('o formă pe care cele trei cote n-o pot scrie își deschide singură tabelul', () => {
  const app = citeste('public', 'app.js');
  assert.match(app, /if \(manual && !c\) manual\.open = true;/,
    'mansarda ar arăta trei casete goale și niciun tabel');
});

test('cheia panoului strâns e în toate cele treizeci de limbi', () => {
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    const v = ia(c, 'editor.conturDeMana');
    assert.ok(v && String(v).trim(), l.cod + ': lipsește editor.conturDeMana');
  });
});

test('cotele din desen stau in afara formei si se citesc', () => {
  /* Stateau peste desen, scrise mic si maro pe maro: „1: 900" se vedea pe
     din doua, taiat de marginea panzei. Acum se impinge fiecare in afara pe
     normala laturii ei, iar marginea panzei se face DUPA ele. */
  const app = citeste('public', 'app.js');
  assert.match(app, /var nx = y2 - y1, ny = x1 - x2;/, 'cota nu se mai imping pe normala');
  assert.match(app, /if \(nx \* \(mx - cx\) \+ ny \* \(my - cy\) < 0\)/,
    'normala nu se mai intoarce dinspre mijlocul formei');
  assert.match(app, /var pad = iesire \+ fs \* 1\.6;/,
    'marginea panzei nu mai tine cont de cote, deci se taie');

  const css = citeste('public', 'styles.css');
  assert.match(css, /\.ct-cota\{[^}]*fill:var\(--accent\)/, 'cotele nu mai au culoare de contrast');
  assert.match(css, /\.ct-cota\{[^}]*stroke:var\(--panel\)/, 'cotele n-au contur, deci nu se citesc peste forma');
  assert.match(css, /paint-order:stroke fill/, 'conturul ar manca literele din interior');
});

/* ---------------- spatiul facut din mai multe corpuri ---------------- */

test('bazele bucatilor se aduna exact la spatiul intreg', () => {
  /* Se rotunjesc MARGINILE, nu latimile. Rotunjind latimile, trei bucati din
     4000 ies de 1333.3 si fac impreuna 3999.9: o zecime de milimetru pierduta
     pe perete, care nu se vede nicaieri dar exista. */
  [[4000, 600, 2200], [2870, 450, 1935], [1200, 300, 2100], [3333, 777, 1111]].forEach(([x, y, z]) => {
    [1, 2, 3, 4].forEach(n => {
      const b = PalCalc.subScaraInBucati(x, y, z, n);
      assert.equal(b.length, n, x + ' in ' + n + ': alt numar de bucati');
      const suma = Math.round(b.reduce((a, q) => a + q.baza, 0) * 10) / 10;
      assert.ok(Math.abs(suma - x) < 0.05,
        x + ' in ' + n + ': bazele fac ' + suma);
    });
  });
});

test('bucatile se leaga intre ele, fara treapta si fara gol', () => {
  /* Doua corpuri lipite pe perete trebuie sa aiba aceeasi inaltime acolo unde
     se ating: inaltimea din dreapta a unuia e cea din stanga a urmatorului. */
  [2, 3, 4].forEach(n => {
    const b = PalCalc.subScaraInBucati(4000, 600, 2200, n);
    for (let i = 1; i < n; i++) {
      assert.ok(Math.abs(b[i].stanga - b[i - 1].dreapta) < 0.05,
        'intre bucata ' + i + ' si ' + (i + 1) + ': ' + b[i - 1].dreapta + ' fata de ' + b[i].stanga);
    }
    /* capetele raman cele ale spatiului intreg */
    assert.ok(Math.abs(b[0].stanga - 2200) < 0.05, 'capatul din stanga s-a mutat');
    assert.ok(Math.abs(b[n - 1].dreapta - 600) < 0.05, 'capatul din dreapta s-a mutat');
  });
});

test('fiecare bucata e tot un corp sub scara, cu conturul inchis', () => {
  PalCalc.subScaraInBucati(4000, 600, 2200, 3).forEach((b, i) => {
    const g = PalCalc.conturGeometrie(b.contur);
    assert.equal(g.W, b.baza, 'bucata ' + (i + 1) + ': gabaritul nu e baza');
    assert.equal(g.H, Math.max(b.stanga, b.dreapta), 'bucata ' + (i + 1) + ': gabaritul pe inaltime');
    const cote = PalCalc.coteSubScara(b.contur);
    assert.ok(cote && !cote.stramb, 'bucata ' + (i + 1) + ': conturul nu se inchide');
  });
});

test('o bucata singura e chiar spatiul intreg', () => {
  const una = PalCalc.subScaraInBucati(900, 400, 800, 1);
  assert.equal(una.length, 1);
  assert.deepEqual([una[0].baza, una[0].dreapta, una[0].stanga], [900, 400, 800]);
  assert.deepEqual(una[0].contur, PalCalc.conturSubScara(900, 400, 800));
});

test('mai mult de zece bucati nu se fac', () => {
  /* Dan: „vreau sa pot pana la 10 corpuri". */
  assert.equal(PalCalc.SUB_SCARA_MAX, 10);
  assert.equal(PalCalc.subScaraInBucati(4000, 600, 2200, 99).length, 10);
  assert.equal(PalCalc.subScaraInBucati(4000, 600, 2200, 0).length, 1);
});

test('ruta face corpurile in comanda, si le plateste pe cele noi', () => {
  const s = citeste('src', 'orders.js');
  assert.match(s, /router\.post\('\/corps\/:id\/sub-scara'/, 'lipseste ruta');
  assert.match(s, /db\.transaction\(\(user, corp, order, bucati, cost\)/,
    'nu se face totul dintr-o data: ar iesi doua corpuri din patru');
  assert.match(s, /CREDIT_INSUFICIENT/, 'nu se opreste cand nu ajunge creditul');
  assert.match(s, /eroare\.subScaraFaraComanda/, 'nu se cere comanda');
  /* bucata intai ia locul corpului deschis, deci NU se plateste din nou */
  const inainte = s.indexOf('bucata întâi ia locul corpului deschis');
  const primaPlata = s.indexOf('credit.scade', inainte);
  const bucla = s.indexOf('for (let i = 1; i < n; i++)', inainte);
  assert.ok(inainte !== -1 && bucla !== -1 && primaPlata > bucla,
    'prima bucata se plateste din nou');
});

test('editorul cere in cate corpuri, si intreaba inainte sa cheltuie', () => {
  const v = citeste('views', 'corps', 'edit.ejs');
  assert.match(v, /id="ssBucati"/, 'lipseste caseta');
  assert.match(v, /orderId: order \? order\.id : null/, 'editorul nu stie de comanda');

  const app = citeste('public', 'app.js');
  assert.match(app, /window\.PalIntreaba\(T\('editor\.subScaraIntreabaPlata'/,
    'cheltuie fara sa intrebe');
  assert.match(app, /function trimiteSubScara/, 'nu trimite la server');
  assert.match(app, /if \(!DATA\.orderId\)/, 'nu verifica daca e intr-o comanda');
});

test('cele sase chei noi sunt in toate cele treizeci de limbi', () => {
  const chei = ['editor.subScaraBucati', 'editor.subScaraFaraComanda',
                'editor.subScaraIntreabaPlata', 'eroare.subScaraCote',
                'eroare.subScaraFaraComanda', 'eroare.creditInsuficient'];
  const ia = (c, k) => k.split('.').reduce((o, x) => (o || {})[x], c);
  const param = v => (String(v).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  const ro = JSON.parse(citeste('locales', 'ro.json'));
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    chei.forEach(k => {
      const v = ia(c, k);
      assert.ok(v && String(v).trim(), l.cod + ': lipseste ' + k);
      assert.equal(param(v), param(ia(ro, k)), l.cod + ': parametri schimbati la ' + k);
    });
    ['{cate}', '{noi}', '{cost}', '{sold}'].forEach(x => {
      assert.ok(String(ia(c, 'editor.subScaraIntreabaPlata')).indexOf(x) !== -1,
        l.cod + ': s-a pierdut ' + x + ' din intrebarea de plata');
    });
  });
});

/* ---------------- lățimile scrise de om ----------------

   Primele se scriu, ultima iese din ce rămâne: suma e peretele, mereu. */

test('lățimile date de om: ultima e restul, înălțimile se iau de pe pantă', () => {
  const b = PalCalc.subScaraDinLatimi(4000, 2200, 600, [1200, 900]);
  assert.deepEqual(b.map(x => x.baza), [1200, 900, 1900]);
  assert.equal(b.reduce((s, x) => s + x.baza, 0), 4000);
  /* Pe pantă de la 600 (stânga) la 2200 (dreapta): la 1200 → 1080. */
  assert.equal(b[0].stanga, 600);
  assert.equal(b[0].dreapta, 1080);
  assert.equal(b[1].stanga, 1080);
  assert.equal(b[2].dreapta, 2200);
});

test('lățimi care nu se pot folosi nu se folosesc', () => {
  const min = PalCalc.SUB_SCARA_LAT_MIN;
  assert.equal(PalCalc.subScaraDinLatimi(4000, 2200, 600, [min - 1]), null, 'un corp prea îngust');
  assert.equal(PalCalc.subScaraDinLatimi(4000, 2200, 600, [3950]), null, 'ultimului nu-i rămâne destul');
  assert.equal(PalCalc.subScaraDinLatimi(4000, 2200, 600, new Array(10).fill(200)), null, 'peste zece corpuri');
  assert.equal(PalCalc.subScaraDinLatimi(4000, 2200, 600, new Array(9).fill(400)).length, 10);
});

test('ruta primește lățimile și cade pe bucăți egale când nu se potrivesc', () => {
  const s = citeste('src', 'orders.js');
  assert.match(s, /Math\.min\(PalCalc\.SUB_SCARA_MAX,/);
  assert.match(s, /PalCalc\.subScaraDinLatimi\(baza, dreapta, stanga, latimi\)/);
  assert.match(s, /dinLatimi \|\| PalCalc\.subScaraInBucati/);
});

test('editorul are până la zece corpuri și casetele de lățime', () => {
  const v = citeste('views', 'corps', 'edit.ejs');
  assert.match(v, /nb <= 10/);
  assert.match(v, /id="ssLatimiCampuri"/);
  const app = citeste('public', 'app.js');
  assert.match(app, /function randeazaLatimi\(/);
  assert.match(app, /function potrivesteRestul\(/);
  assert.match(app, /\['latimi', \(latimi \|\| \[\]\)\.join\(','\)\]/);
});
