'use strict';
/* Secțiunea de informații a site-ului. Testele de-aici păzesc trei lucruri:
   adresa articolului, drumul prin care textul ajunge în pagină, și faptul că
   o ciornă rămâne ciornă. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* Nu cerem `src/articole.js`: ar deschide baza de date doar ca să probăm
   o funcţie de text şi să citim nişte vederi. Funcţia stă în shared/, iar
   lista de secţiuni o citim din sursă, ca testul să cadă dacă se schimbă. */
const { faSlug } = require('../shared/slug');

const ARTICOL_EJS = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'articole', 'articol.ejs'), 'utf8');
const LISTA_EJS = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'articole', 'index.ejs'), 'utf8');
const SURSA = fs.readFileSync(path.join(__dirname, '..', 'src', 'articole.js'), 'utf8');

const GRUPURI = (SURSA.match(/const GRUPURI = \[([^\]]*)\]/)[1].match(/'[^']+'/g) || [])
  .map(s => s.slice(1, -1));

/* ---------------- adresa ---------------- */

test('diacriticele se duc pe litera de bază, nu pe cratimă', () => {
  assert.equal(faSlug('Polița și cantul gros'), 'polita-si-cantul-gros');
  assert.equal(faSlug('Înălțime și adâncime'), 'inaltime-si-adancime');
  assert.equal(faSlug('Ce se întâmplă cu PAL-ul de 18'), 'ce-se-intampla-cu-pal-ul-de-18');
});

test('adresa nu începe și nu se termină cu cratimă', () => {
  assert.equal(faSlug('  — Cant —  '), 'cant');
  assert.equal(faSlug('!!!'), '');
  assert.equal(faSlug('a // b'), 'a-b');
});

test('adresa nu poate ieși din drumul ei', () => {
  /* Slugul intră în adresa paginii. O bară, un „.." sau un procent acolo ar
     însemna alt drum decât cel pe care-l credem. Nu mai cerem doar a–z:
     adresele au voie să poarte litere din orice scriere. Cerem ca tot ce
     NU e literă, cifră sau semn combinat să fi căzut. */
  ['../../etc/passwd', 'a/b/c', 'a?x=1', 'a#b', 'a%2Fb', 'a\u0000b',
   '  ..  ', 'a b\tc\nd', '<script>', "a'b\"c"].forEach(rau => {
    const s = faSlug(rau);
    assert.ok(/^[\p{L}\p{N}\p{M}-]*$/u.test(s), `a rămas ceva ciudat în adresă: ${s}`);
    assert.ok(!/[/\\?#%.\s]/.test(s), `a rămas un semn de drum în adresă: ${s}`);
  });
});

test('fiecare scriere își păstrează literele în adresă', () => {
  /* Pe un site în 30 de limbi, un titlu chinezesc sau arab care dă slug gol
     înseamnă că toate articolele din limba aia ajung „articol-2", „articol-3".
     Semnele de vocală din arabă, hindi și thailandeză sunt litere acolo:
     dacă le pierdem, cuvântul se sparge. */
  const cazuri = [
    ['Polița și cantul', 'polita-si-cantul'],
    ['Kanten und Maße größer', 'kanten-und-masse-grosser'],
    ['قائمة التقطيع', 'قائمة-التقطيع'],
    ['काटने की सूची', 'काटने-की-सूची'],
    ['รายการตัด', 'รายการตัด'],
    ['板材开料与封边', '板材开料与封边']
  ];
  cazuri.forEach(([titlu, astept]) => assert.equal(faSlug(titlu), astept));

  ['Раскрой плиты', 'Λίστα κοπής', '引き出しの木取り', '미닫이문 재단',
   'فهرست برش', 'רשימת ניסור'].forEach(titlu => {
    assert.ok(faSlug(titlu).length > 2, `slug gol sau ciuntit pentru „${titlu}"`);
  });
});

test('adresa se scrie compus, ca s-o regăsim după ce vine din browser', () => {
  /* Browserul trimite adresa în NFC. Dacă în bază stă descompusă, căutarea
     după slug nu găsește nimic, deși ochiul vede același cuvânt. */
  const s = faSlug('قائمة');
  assert.equal(s, s.normalize('NFC'));
});

test('adresa se taie la o lungime cuminte', () => {
  assert.ok(faSlug('x'.repeat(300)).length <= 80);
});

/* ---------------- drumul textului spre pagină ---------------- */

test('pagina articolului nu tipărește niciodată textul brut', () => {
  /* `<%- %>` tipărește fără să scape. Singurul lucru care are voie să treacă
     pe-acolo e `articol.html`, adică ieșirea din shared/markdown.js. Dacă
     cineva pune `<%- articol.corp %>`, tot ce scrie un autor devine HTML. */
  const brute = ARTICOL_EJS.match(/<%-([\s\S]*?)%>/g) || [];
  brute.forEach(b => {
    assert.ok(/articol\.html/.test(b) || /include\(/.test(b),
      `iese ceva netrecut prin markdown: ${b.trim()}`);
  });
  assert.match(ARTICOL_EJS, /<%-\s*articol\.html\s*%>/);
  assert.ok(!/<%-[^%]*articol\.corp/.test(ARTICOL_EJS),
    'textul brut al articolului ajunge direct în pagină');
});

test('lista nu tipărește nimic fără scăpare', () => {
  const brute = LISTA_EJS.match(/<%-([\s\S]*?)%>/g) || [];
  brute.forEach(b => {
    assert.ok(/include\(/.test(b), `iese ceva nescăpat în listă: ${b.trim()}`);
  });
});

test('rezumatul din listă vine din text curățat, nu din corpul brut', () => {
  assert.match(SURSA, /rezumatText:\s*rand\.rezumat \|\| Markdown\.rezumat\(/);
});

/* ---------------- ciornele ---------------- */

test('paginile publice cer `publicat = 1`, amândouă', () => {
  const publice = SURSA.slice(SURSA.indexOf('paginile publice'), SURSA.indexOf('administrare'));
  const interogari = publice.match(/FROM articole[\s\S]*?ORDER BY/g) || [];
  assert.equal(interogari.length, 2, 's-au schimbat interogările publice');
  interogari.forEach(q => {
    assert.match(q, /publicat = 1/, `o pagină publică arată și ciornele: ${q.trim()}`);
  });
});

test('editorul e închis pentru cine nu e administrator', () => {
  const rute = SURSA.match(/router\.(get|post)\('\/admin\/articole[^)]*\)/g) || [];
  assert.ok(rute.length >= 5, `prea puține rute de administrare: ${rute.length}`);
  rute.forEach(r => {
    assert.match(r, /requireAuth, requireAdmin/, `rută de administrare deschisă: ${r}`);
  });
});

/* ---------------- secțiunile ---------------- */

test('fiecare secțiune are nume în toate cele 30 de limbi', () => {
  const LOCALES = path.join(__dirname, '..', 'locales');
  fs.readdirSync(LOCALES).filter(f => f.endsWith('.json')).forEach(f => {
    const dict = JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'));
    GRUPURI.forEach(g => {
      const cheie = 'grup' + g.charAt(0).toUpperCase() + g.slice(1);
      assert.ok(dict.articole && dict.articole[cheie],
        `${f} n-are articole.${cheie}; în listă s-ar vedea cheia brută`);
    });
  });
});
