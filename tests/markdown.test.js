'use strict';
/* Motorul de text al articolelor. Ce se scrie într-un articol ajunge într-o
   pagină publică, așa că jumătate din testele de-aici sunt despre ce NU are
   voie să iasă. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { randeaza, rezumat, adresaBuna } = require('../shared/markdown');

/* ---------------- ce nu are voie să treacă ---------------- */

test('HTML-ul scris în articol iese ca text, nu ca HTML', () => {
  const h = randeaza('Atenție <script>alert(1)</script> la debitare');
  assert.ok(!/<script/.test(h), 'a trecut o etichetă de script');
  assert.match(h, /&lt;script&gt;/);
});

/* Invarianta tare, din care ies toate celelalte: în pagină nu poate apărea
   decât o etichetă din lista noastră. Orice ar scrie autorul — script, img
   cu onerror, iframe — iese ca text scăpat, deci n-are cum să devină
   etichetă. Nu ne uităm după cuvinte rele în text, ci după ce a ieșit. */
const ETICHETE_BUNE = ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'b', 'i', 'code', 'a', 'blockquote', 'hr', 'div', 'table', 'thead', 'tbody',
  'tr', 'th', 'td'];

function eticheteleDin(html) {
  return html.match(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi) || [];
}

test('în pagină nu iese nicio etichetă în afara celor pe care le scriem noi', () => {
  [
    '<img src=x onerror=alert(1)>',
    '<div onclick="alert(1)">clic</div>',
    '**<iframe src="//rau"></iframe>**',
    '- <svg onload=alert(1)>',
    '> <object data="rau"></object>',
    '<style>body{display:none}</style>',
    '<!-- <script>x</script> -->',
    '| <form action=x> | b |\n| --- | --- |\n| <input> | d |'
  ].forEach(rau => {
    const h = randeaza(rau);
    eticheteleDin(h).forEach(et => {
      const nume = et.match(/<\/?([a-z][a-z0-9]*)/i)[1].toLowerCase();
      assert.ok(ETICHETE_BUNE.indexOf(nume) !== -1, `a ieșit eticheta <${nume}> din: ${rau}`);
      assert.ok(!/\son\w+\s*=/i.test(et), `o etichetă a noastră poartă un eveniment: ${et}`);
    });
    /* iar textul rău trebuie să se vadă ca text, nu să dispară în tăcere */
    assert.match(h, /&lt;/, `textul a dispărut, în loc să fie scăpat: ${rau}`);
  });
});

test('legăturile care sunt de fapt cod rămân doar text', () => {
  ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>x</script>',
   'vbscript:msgbox', 'file:///etc/passwd'].forEach(rea => {
    const h = randeaza(`vezi [aici](${rea})`);
    assert.ok(!/<a /.test(h), `a ieșit o legătură pentru ${rea}`);
    assert.match(h, /aici/, 'textul legăturii n-are voie să dispară');
  });
});

test('legăturile bune trec, iar cele spre afară nu ne dau fereastra', () => {
  const afara = randeaza('vezi [catalogul](https://egger.com/decor)');
  assert.match(afara, /<a href="https:\/\/egger\.com\/decor"[^>]*>catalogul<\/a>/);
  assert.match(afara, /rel="noopener nofollow"/);

  const acasa = randeaza('mergi la [comenzi](/orders)');
  assert.match(acasa, /<a href="\/orders">comenzi<\/a>/);
  assert.ok(!/target=/.test(acasa), 'o legătură din site nu se deschide în altă filă');
});

test('ghilimelele dintr-o adresă nu pot ieși din atribut', () => {
  const h = randeaza('[x](/a"onmouseover="alert(1))');
  /* Ghilimeaua ajunge aici deja scăpată, deci în atribut intră `&amp;quot;`:
     nu mai poate închide `href` ca să deschidă alt atribut după el. */
  assert.match(h, /<a href="[^"]*">x<\/a>/, 'atributul href nu mai e o bucată întreagă');
  const et = h.match(/<a [^>]*>/)[0];
  assert.ok(!/\son\w+\s*=/i.test(et), `a ieșit un eveniment în etichetă: ${et}`);
});

/* ---------------- ce trebuie să iasă ---------------- */

test('titlurile autorului încep de la h2, ca să nu bată cu titlul paginii', () => {
  assert.match(randeaza('# Despre cant'), /<h2>Despre cant<\/h2>/);
  assert.match(randeaza('## Cantul gros'), /<h3>Cantul gros<\/h3>/);
  /* mai adânc de h6 nu există */
  assert.match(randeaza('###### foarte adânc'), /<h6>foarte adânc<\/h6>/);
});

test('paragrafele, aldinul, cursivul și codul', () => {
  const h = randeaza('Placa de **18 mm** e *obișnuită*.\nRândul doi.\n\nAlt paragraf cu `cg = 2`.');
  assert.match(h, /<p>Placa de <b>18 mm<\/b> e <i>obișnuită<\/i>\. Rândul doi\.<\/p>/);
  assert.match(h, /<p>Alt paragraf cu <code>cg = 2<\/code>\.<\/p>/);
});

test('steluțele din cod rămân steluțe', () => {
  assert.match(randeaza('scrie `**asta**` ca să iasă aldin'), /<code>\*\*asta\*\*<\/code>/);
});

test('liste, citat și linie despărțitoare', () => {
  assert.match(randeaza('- unu\n- doi'), /<ul><li>unu<\/li><li>doi<\/li><\/ul>/);
  assert.match(randeaza('1. unu\n2. doi'), /<ol><li>unu<\/li><li>doi<\/li><\/ol>/);
  assert.match(randeaza('> zice atelierul'), /<blockquote>zice atelierul<\/blockquote>/);
  assert.match(randeaza('---'), /<hr>/);
});

test('o listă ordonată nu se lipește de una neordonată', () => {
  const h = randeaza('- unu\n1. doi');
  assert.match(h, /<ul><li>unu<\/li><\/ul>/);
  assert.match(h, /<ol><li>doi<\/li><\/ol>/);
});

test('tabelele simple ies tabel, cu clasa noastră de derulare', () => {
  const h = randeaza('| Grosime | Se scade |\n| --- | --- |\n| 2 mm | 1.5 |\n| 0.8 mm | 0 |');
  assert.match(h, /<div class="tbl"><table>/);
  assert.match(h, /<th>Grosime<\/th><th>Se scade<\/th>/);
  assert.match(h, /<td>2 mm<\/td><td>1\.5<\/td>/);
  assert.match(h, /<td>0\.8 mm<\/td><td>0<\/td>/);
});

test('o linie cu bară care nu e tabel rămâne paragraf', () => {
  const h = randeaza('alege 16 | 18 | 25 mm');
  assert.match(h, /<p>alege 16 \| 18 \| 25 mm<\/p>/);
  assert.ok(!/<table/.test(h));
});

test('textul pe care nu-l înțelege nu dispare', () => {
  const h = randeaza('~~tăiat~~ și ![poză](x.png)');
  assert.match(h, /~~tăiat~~/);
  assert.match(h, /poză/);
});

test('articolul gol nu dă eroare', () => {
  assert.equal(randeaza(''), '');
  assert.equal(randeaza(null), '');
  assert.equal(randeaza(undefined), '');
});

/* ---------------- rezumatul ---------------- */

test('rezumatul scoate semnele și se oprește la un cuvânt întreg', () => {
  const r = rezumat('# Titlu\n\nCantul de **2 mm** se scade cu 1.5 la [debitare](/x).', 40);
  assert.ok(!/[#*[\]()]/.test(r), `au rămas semne: ${r}`);
  assert.match(r, /^Titlu Cantul de 2 mm/);
  assert.ok(r.endsWith('…'));
  assert.ok(!/ …$/.test(r), 'nu tăiem în mijlocul unui spațiu');
});

test('un text scurt se întoarce întreg, fără trei puncte', () => {
  assert.equal(rezumat('Scurt și bun.', 100), 'Scurt și bun.');
});

/* ---------------- adresele ---------------- */

test('adresaBuna spune limpede ce trece și ce nu', () => {
  ['https://x.ro', 'http://x.ro', 'mailto:a@b.ro', '/orders', '#jos'].forEach(bun => {
    assert.ok(adresaBuna(bun), `ar fi trebuit să treacă: ${bun}`);
  });
  ['javascript:x', 'data:text/html,x', 'vbscript:x', 'file:///c', 'x.ro', '', null].forEach(rau => {
    assert.equal(adresaBuna(rau), null, `n-ar fi trebuit să treacă: ${rau}`);
  });
});
