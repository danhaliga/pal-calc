/* Limbile: alegerea, pluralul, căderea pe română și traducerea pieselor. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const I18n = require('../shared/i18n');
const { calc, defaults, csv, numeDirectie } = require('../shared/calc');
const { raport, feronerie } = require('../shared/raport');
const Fero = require('../shared/feronerie');

const LOCALES = path.join(__dirname, '..', 'locales');

/* ---------------- lista de limbi ---------------- */

test('sunt exact 30 de limbi, cu română între ele, fără coduri duble', () => {
  assert.equal(I18n.LIMBI.length, 30);
  assert.equal(I18n.IMPLICITA, 'ro');
  assert.ok(I18n.CODURI.includes('ro'));
  assert.equal(new Set(I18n.CODURI).size, 30);

  I18n.LIMBI.forEach(l => {
    assert.ok(/^[a-z]{2}$/.test(l.cod), `cod ciudat: ${l.cod}`);
    assert.ok(l.nume && l.nume.trim(), `${l.cod} nu are endonim`);
    assert.ok(l.dir === 'ltr' || l.dir === 'rtl', `${l.cod} are direcția ${l.dir}`);
  });
});

test('araba, ebraica și persana se scriu de la dreapta la stânga', () => {
  const rtl = I18n.LIMBI.filter(l => l.dir === 'rtl').map(l => l.cod).sort();
  assert.deepEqual(rtl, ['ar', 'fa', 'he']);
});

/* ---------------- normalizarea și Accept-Language ---------------- */

test('codurile regionale și cele vechi cad pe limba pe care o avem', () => {
  assert.equal(I18n.normalizeaza('ro-RO'), 'ro');
  assert.equal(I18n.normalizeaza('PT_BR'), 'pt');
  assert.equal(I18n.normalizeaza('zh-Hans-CN'), 'zh');
  assert.equal(I18n.normalizeaza('iw'), 'he');       /* codul vechi al ebraicei */
  assert.equal(I18n.normalizeaza('in'), 'id');       /* codul vechi al indonezienei */
  assert.equal(I18n.normalizeaza('mo'), 'ro');       /* „moldovenească” */
  assert.equal(I18n.normalizeaza('klingon'), null);
  assert.equal(I18n.normalizeaza(''), null);
  assert.equal(I18n.normalizeaza(null), null);
});

test('Accept-Language alege limba cu q-ul cel mai mare pe care o avem', () => {
  assert.equal(I18n.dinAntet('fr-CA,fr;q=0.9,en;q=0.8'), 'fr');
  assert.equal(I18n.dinAntet('xx;q=1.0,de-AT;q=0.5'), 'de');
  assert.equal(I18n.dinAntet('en;q=0.3,hu;q=0.9'), 'hu');
  assert.equal(I18n.dinAntet('zz-ZZ'), null);
  assert.equal(I18n.dinAntet(''), null);
  assert.equal(I18n.dinAntet(undefined), null);
});

/* ---------------- pluralul ---------------- */

test('româna are trei forme, după regula CLDR', () => {
  assert.equal(I18n.categorie('ro', 1), 'one');
  assert.equal(I18n.categorie('ro', 0), 'few');
  assert.equal(I18n.categorie('ro', 19), 'few');
  assert.equal(I18n.categorie('ro', 20), 'other');
  assert.equal(I18n.categorie('ro', 101), 'few');    /* 101 % 100 = 1 */
});

test('slavele și araba își au propriile categorii', () => {
  assert.equal(I18n.categorie('ru', 21), 'one');
  assert.equal(I18n.categorie('ru', 22), 'few');
  assert.equal(I18n.categorie('ru', 25), 'many');
  assert.equal(I18n.categorie('pl', 1), 'one');
  assert.equal(I18n.categorie('pl', 22), 'few');
  assert.equal(I18n.categorie('pl', 25), 'many');
  assert.equal(I18n.categorie('cs', 3), 'few');
  assert.equal(I18n.categorie('cs', 5), 'many');
  assert.equal(I18n.categorie('ar', 0), 'zero');
  assert.equal(I18n.categorie('ar', 2), 'two');
  assert.equal(I18n.categorie('ar', 7), 'few');
  assert.equal(I18n.categorie('ar', 50), 'many');
  assert.equal(I18n.categorie('zh', 5), 'other');
  assert.equal(I18n.categorie('he', 2), 'two');
});

test('„{n} corpuri” iese cu forma potrivită în română', () => {
  const t = I18n.creeaza('ro');
  assert.equal(t('comenzi.nrCorpuri', { n: 1 }), '1 corp');
  assert.equal(t('comenzi.nrCorpuri', { n: 3 }), '3 corpuri');
  assert.equal(t('comenzi.nrCorpuri', { n: 25 }), '25 de corpuri');
});

/* ---------------- traducerea ---------------- */

test('o cheie netradusă cade pe română, nu pe cheia brută', () => {
  /* o limbă în care traducerea abia a început */
  I18n.inregistreaza('nl', { piesa: { blat: 'Bovenblad' } });
  const nl = I18n.creeaza('nl');

  assert.equal(nl.lang, 'nl');
  assert.equal(nl('piesa.blat'), 'Bovenblad');
  assert.equal(nl('piesa.laterala'), I18n.creeaza('ro')('piesa.laterala'));

  /* catalogul adevărat se reîncarcă pentru testele următoare */
  I18n.inregistreaza('nl', JSON.parse(fs.readFileSync(path.join(LOCALES, 'nl.json'), 'utf8')));
  assert.equal(I18n.creeaza('nl')('piesa.laterala'), 'Zijwand');
});

test('cheia care nu există nicăieri se vede, ca să fie reparată', () => {
  assert.equal(I18n.creeaza('ro')('nu.exista.nicaieri'), 'nu.exista.nicaieri');
});

test('parametrii intră în text fără formatare locală', () => {
  const t = I18n.creeaza('ro');
  /* cotele de debitare se scriu cu punct, la fel în toate limbile */
  assert.equal(t('cnc.detTaiere45', { diag: 455.4 }),
               'tăiere la 45°, muchie diagonală 455.4 mm, cantuită');
  assert.equal(I18n.creeaza('de')('cnc.detTaiere45', { diag: 1234.5 }).includes('1234.5'), true);
});

test('t.numar formatează local, pentru bani și totaluri', () => {
  assert.equal(I18n.creeaza('ro').numar(1234.5), '1.234,5');
  assert.equal(I18n.creeaza('en').numar(1234.5), '1,234.5');
  assert.equal(I18n.creeaza('ro').numar(12, 2), '12,00');
});

test('direcția paginii vine din limbă', () => {
  assert.equal(I18n.creeaza('ro').dir, 'ltr');
  assert.equal(I18n.creeaza('ar').dir, 'rtl');
  assert.equal(I18n.creeaza('he').dir, 'rtl');
});

/* ---------------- catalogul românesc ---------------- */

test('catalogul românesc are toate cheile folosite de motorul de calcul', () => {
  const t = I18n.creeaza('ro');
  const c = calc(Object.assign(defaults(), { nSer: 2, nPol: 2, hFront: 200, hCutie: 150 }));

  c.P.forEach(p => {
    assert.ok(t.are('piesa.' + p.cheie), `lipsește piesa.${p.cheie}`);
    assert.notEqual(p.nume, 'piesa.' + p.cheie, `piesa ${p.cheie} n-a fost tradusă`);
    if (p.notaCheie) assert.ok(t.are('nota.' + p.notaCheie), `lipsește nota.${p.notaCheie}`);
    assert.ok(t.are('fibra.' + p.fibra), `lipsește fibra.${p.fibra}`);
  });
});

test('fiecare avertisment din calcul are text în română', () => {
  const t = I18n.creeaza('ro');
  const cazuri = [
    { nUsi: 1, W: 900, montaj: 'aplicat', balama: '18' },   /* ușă lată + cot greșit */
    { nPol: 1, W: 1000 },                                   /* poliță lungă */
    { nSer: 1, lg: 900 },                                   /* glisieră prea lungă */
    { tip: 'colt-orb', orb: 5000 },                         /* zonă oarbă prea mare */
    { tip: 'colt-L', W: 400, W2: 400, D: 560 }              /* adâncime prea mare */
  ];

  let gasite = 0;
  cazuri.forEach(over => {
    const c = calc(Object.assign(defaults(), over));
    c.avertismente.forEach(a => {
      gasite++;
      assert.ok(t.are('avert.' + a.cheie), `lipsește avert.${a.cheie}`);
      assert.notEqual(a.text, 'avert.' + a.cheie, `avertismentul ${a.cheie} n-a fost tradus`);
    });
  });
  assert.ok(gasite >= 5, `prea puține avertismente declanșate: ${gasite}`);
});

test('toate articolele de feronerie au nume în română', () => {
  const t = I18n.creeaza('ro');
  const params = Object.assign(defaults(), { nUsi: 2, nSer: 2, nPol: 2, D: 320,
                                             hFront: 200, hCutie: 150, tip: 'colt-L' });
  ['minifix', 'confirmat', 'cepuri-suruburi'].forEach(asamblare => {
    ['blum-clip', 'universal', 'fara'].forEach(balama => {
      ['bila', 'tandem', 'fara'].forEach(glisiere => {
        const s = Fero.sistem({ asamblare, balama, glisiere, suspensii: true }, t);
        feronerie(params, calc(params), s, t).forEach(f => {
          assert.ok(f.nume && !/^fero\./.test(f.nume), `articol netradus: ${f.nume}`);
          assert.ok(!/^comun\./.test(f.um), `unitate netradusă: ${f.um}`);
        });
      });
    });
  });
});

test('direcțiile laturilor se traduc, nu rămân coduri', () => {
  assert.equal(numeDirectie(0), 'jos');
  assert.equal(numeDirectie(90), 'dreapta');
  assert.equal(numeDirectie(180), 'sus');
  assert.equal(numeDirectie(270), 'stânga');
  assert.match(numeDirectie(24), /înclinată 24°/);
});

/* ---------------- același raport, altă limbă ---------------- */

const matTest = {
  id: 1, nume: 'Alb W980', rol: 'corp', brand: 'Egger',
  decor_cod: 'W980 ST2', decor_nume: 'Alb', pal_mm: 18,
  cant_gros: 2, cant_subtire: 0.4, hex: '#ffffff'
};

function raportIn(lang) {
  const t = I18n.creeaza(lang);
  return raport(
    { id: 1, name: 'Test', materiale: [matTest], formate: ['intreaga'], feronerie: null },
    [{ id: 1, name: 'Corp', poz: 1,
       params: Object.assign(defaults(), { nSer: 1, hFront: 200, hCutie: 150 }),
       materiale: { corp: matTest, front: matTest, sertar: matTest } }],
    { effortMs: 0, adaosCant: 15, t }
  );
}

test('limba nu schimbă cotele, doar textele', () => {
  const ro = raportIn('ro');
  const en = raportIn('en');

  assert.deepEqual(en.piese.map(p => p.cheie), ro.piese.map(p => p.cheie));
  assert.deepEqual(en.piese.map(p => p.TL), ro.piese.map(p => p.TL));
  assert.deepEqual(en.piese.map(p => p.Tl), ro.piese.map(p => p.Tl));
  assert.equal(en.totaluri.bucati, ro.totaluri.bucati);
  assert.equal(en.cant.total, ro.cant.total);
});

test('CSV-ul își traduce antetul, dar păstrează cifrele', () => {
  const c = Object.assign(defaults(), { nume: 'Corp' });
  const ro = csv([c], I18n.creeaza('ro')).split('\n');
  const de = csv([c], I18n.creeaza('de')).split('\n');

  assert.equal(ro.length, de.length);
  assert.match(ro[0], /^"?Corp/);
  /* coloanele numerice sunt identice, oricare ar fi limba */
  const cifre = linie => linie.split(';').slice(2, 11).join(';');
  for (let i = 1; i < ro.length; i++) assert.equal(cifre(de[i]), cifre(ro[i]));
});

/* ---------------- fișierele de traducere ---------------- */

test('fiecare fișier din locales/ este JSON valid și are un cod cunoscut', () => {
  const fisiere = fs.readdirSync(LOCALES).filter(f => f.endsWith('.json'));
  assert.ok(fisiere.length >= 1, 'nu există niciun catalog');

  fisiere.forEach(f => {
    const cod = f.replace(/\.json$/, '');
    assert.ok(I18n.CODURI.includes(cod), `locales/${f} nu corespunde niciunei limbi`);
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8')),
                        `locales/${f} nu e JSON valid`);
  });
});

/* Scrisul fiecărei limbi: la tastat se strecoară ușor un „к” chirilic într-un
   text latin, și nu se vede cu ochiul liber. */
const SCRIERI = {
  chirilic: /[Ѐ-ӿ]/, arab: /[؀-ۿ]/, ebraic: /[֐-׿]/,
  grec: /[Ͱ-Ͽ]/, chinez: /[一-鿿]/, japonez: /[぀-ヿ]/,
  coreean: /[가-힯]/, thai: /[฀-๿]/, devanagari: /[ऀ-ॿ]/
};

/* Sârba se scrie și cu chirilice, și cu latine; alegem latinele, cum scrie
   și numele limbii în selectorul de limbă. */
const SCRIERE_ASTEPTATA = {
  ru: 'chirilic', uk: 'chirilic', bg: 'chirilic',
  ar: 'arab', fa: 'arab', he: 'ebraic', el: 'grec',
  zh: 'chinez', ja: 'japonez', ko: 'coreean', th: 'thai', hi: 'devanagari'
};

test('fiecare limbă folosește doar scrierea ei', () => {
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const cod = f.replace(/\.json$/, '');
    const text = fs.readFileSync(path.join(LOCALES, f), 'utf8');
    const a = SCRIERE_ASTEPTATA[cod];

    Object.keys(SCRIERI).forEach(scriere => {
      if (scriere === a) return;
      /* japoneza scrie și cu ideograme chinezești, e normal */
      if (cod === 'ja' && scriere === 'chinez') return;
      const gasite = [...new Set(text.match(new RegExp(SCRIERI[scriere], 'g')) || [])];
      assert.deepEqual(gasite, [],
        `${f} conține semne ${scriere}e: ${gasite.join(' ')}`);
    });
  });
});

/* Cealaltă jumătate a aceleiași greșeli: un „i” sau un „o” latin rămas
   în mijlocul unui cuvânt chirilic sau grecesc. Testul de mai sus nu-l
   prinde, fiindcă latinele sunt normale în „Blum”, „CSV” sau „W1000” —
   dar lipite de o literă chirilică n-au ce căuta.

   Doar chirilic și grec: numai ele împart forme cu latinele, deci numai
   la ele o literă latină lipită e o greșeală de tastat. Ebraica și araba
   n-au nicio literă care să semene cu una latină, iar acolo lipirea e
   corectă: „ב־CNC”, „والتجميع وCNC” — un „ו”/„و” se scrie legat. */
const AMESTEC = new RegExp(
  '[A-Za-z](?=\\p{L})[\\p{Script=Cyrillic}\\p{Script=Greek}]' +
  '|(?=\\p{L})[\\p{Script=Cyrillic}\\p{Script=Greek}][A-Za-z]',
  'gu');

test('nicio literă latină nu s-a strecurat într-un cuvânt chirilic sau grec', () => {
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const text = fs.readFileSync(path.join(LOCALES, f), 'utf8');
    const gasite = [...new Set(text.match(AMESTEC) || [])];
    assert.deepEqual(gasite, [],
      `${f} amestecă litere latine cu chirilice sau grece în același cuvânt: ${gasite.join(' ')}`);
  });
});

test('nicio traducere nu inventează chei care nu există în română', () => {
  const ro = JSON.parse(fs.readFileSync(path.join(LOCALES, 'ro.json'), 'utf8'));
  const cheiRo = new Set(plat(ro));

  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json') && f !== 'ro.json').forEach(f => {
    const alta = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    const straine = plat(alta).filter(k => !cheiRo.has(k));
    assert.deepEqual(straine, [], `${f} are chei care nu există în ro.json: ${straine.join(', ')}`);
  });
});

test('formele de plural sunt cele pe care limba chiar le folosește', () => {
  const ro = JSON.parse(fs.readFileSync(path.join(LOCALES, 'ro.json'), 'utf8'));
  const cheiPlural = plat(ro, '', [], true);

  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const cod = f.replace(/\.json$/, '');
    const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    const cerute = new Set([0, 1, 2, 3, 5, 11, 21, 25, 100].map(n => I18n.categorie(cod, n)));

    cheiPlural.forEach(k => {
      const v = adanc(dict, k);
      if (!v) return;                                   /* cheia lipsește: cade pe română */
      cerute.forEach(cat => {
        assert.ok(v[cat] !== undefined,
                  `${f}: cheia ${k} nu are forma „${cat}”, de care ${cod} are nevoie`);
      });
    });
  });
});

const FORME = ['zero', 'one', 'two', 'few', 'many', 'other'];

function estePlural(v) {
  const k = Object.keys(v);
  return k.length > 0 && k.every(x => FORME.includes(x));
}

function plat(o, prefix, afara, doarPlural) {
  const out = afara || [];
  for (const k of Object.keys(o || {})) {
    const v = o[k];
    const cheie = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !estePlural(v)) {
      plat(v, cheie, out, doarPlural);
    } else if (!doarPlural || (v && typeof v === 'object' && estePlural(v))) {
      out.push(cheie);
    }
  }
  return out;
}

function adanc(o, cheie) {
  return cheie.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
}
