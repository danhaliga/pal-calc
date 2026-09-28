/* ============================================================
   Unitatea de măsură.

   Toată aplicația socotește și păstrează în MILIMETRI. Aici se face singura
   trecere: dintre milimetru și ce vede ochiul. Nicăieri altundeva nu se
   convertește nimic — o cotă în țoli scrisă în baza de date ar aduna erori
   de rotunjire la fiecare salvare, și peste un an cotele nu s-ar mai
   închide.

   DOUĂ LUCRURI DE ȘTIUT, pe care le-am aflat măsurând, nu presupunând:

   1. FRACȚII, NU ZECIMALE. Un atelier american scrie 22½", nu 22.5". Dacă
      vede zecimale, știe din prima că unealta e făcută de cineva care nu
      lucrează așa.

   2. PASUL DE ROTUNJIRE E PARTEA GREA. Motorul rotunjea fiecare cotă de
      debitare la 0,1 mm — perfect pentru un ferăstrău cu afișaj metric.
      Dar 1/64 de țol înseamnă 0,397 mm, deci rotunjirea la 0,1 mm e un
      sfert din cea mai fină fracție pe care o folosește cineva. Cu ea în
      drum, cota NU POATE cădea vreodată pe o fracție curată, oricât de
      curate ar fi datele de intrare. De-aia pasul pleacă de aici și ajunge
      până în `shared/calc.js`.

   Pasul ales pentru țoli e 1/16 — cât citește omul pe ruletă. Se schimbă
   dintr-un singur loc dacă se dovedește prea gros.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalUnitati = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOL = 25.4;                 /* exact, prin definiție din 1959 */

  /* `peMm` e câte crestături intră într-un milimetru, și rotunjirea se face
     ÎNMULȚIND cu el, nu împărțind la pas. Pare același lucru și nu e: cu
     împărțire, 571,55 mm ieșea 571,5, fiindcă 571.55/0.1 dă 5715.499999 în
     virgulă mobilă. Cu înmulțire iese 571,6 — adică exact ce dădea
     rotunjirea de dinainte, `Math.round(v * 10) / 10`.

     Diferența e de o zecime de milimetru și apare numai la mijlocul
     crestăturii, dar ar fi mutat cotele unor corpuri deja tăiate. */
  var UNITATI = {
    mm: {
      cod: 'mm',
      /* Zecimi de milimetru. Atâta arată afișajul unui ferăstrău de panouri. */
      peMm: 10,
      semn: 'mm'
    },
    inch: {
      cod: 'inch',
      numitor: 16,
      peMm: 16 / TOL,
      semn: '"'
    }
  };

  function u(unitate) {
    return UNITATI[String(unitate || '').toLowerCase()] || UNITATI.mm;
  }

  function pas(unitate) { return 1 / u(unitate).peMm; }

  /* ---------- rotunjirea ---------- */

  /* O cotă în milimetri, adusă pe grila unității. Rezultatul rămâne în
     milimetri: nu se schimbă felul valorii, doar cresătura pe care stă. */
  function rotunjeste(mm, unitate) {
    var v = Number(mm);
    if (!isFinite(v)) return v;
    var n = u(unitate).peMm;
    var r = Math.round(v * n) / n;
    /* Socoteala în virgulă mobilă lasă cozi de felul 601.6624999999999.
       Se taie la a șasea zecimală: mai fin decât orice ferăstrău, și destul
       cât să nu iasă cozile în lista de debitare. */
    return Math.round(r * 1e6) / 1e6;
  }

  /* Dacă o cotă stă deja fix pe grila unității. Folosit ca să se poată
     însemna, mai târziu, cotele care se ARATĂ rotunjite — un corp gândit în
     milimetri, deschis de cineva care lucrează în țoli, are cote care nu cad
     pe nicio fracție, iar rotunjirea la afișare e o minciună mică pe care
     omul are dreptul s-o vadă. */
  function esteExact(mm, unitate) {
    var v = Number(mm);
    if (!isFinite(v)) return false;
    var p = pas(unitate);
    return Math.abs(v / p - Math.round(v / p)) * p < 1e-6;
  }

  /* ---------- scrisul ---------- */

  function celMaiMareDivizor(a, b) { return b ? celMaiMareDivizor(b, a % b) : a; }

  /* Milimetri -> ce vede ochiul. Fără semnul unității: ăla se pune unde
     trebuie, o dată pe tabel, nu pe fiecare număr. */
  function scrie(mm, unitate) {
    var v = Number(mm);
    if (!isFinite(v)) return '';
    var uu = u(unitate);

    if (uu.cod === 'mm') {
      /* Zecimala se arată numai dacă e. „571.5" da, „560.0" nu: un zero
         în plus pe fiecare rând face lista de debitare mai greu de citit. */
      var z = Math.round(v * 10) / 10;
      return String(z);
    }

    var semn = v < 0 ? '-' : '';
    var toli = Math.abs(v) / TOL;
    var n = uu.numitor;
    var sferturi = Math.round(toli * n);
    var intreg = Math.floor(sferturi / n);
    var rest = sferturi - intreg * n;

    if (!rest) return semn + intreg;

    var d = celMaiMareDivizor(rest, n);
    var fractie = (rest / d) + '/' + (n / d);
    return intreg ? semn + intreg + ' ' + fractie : semn + fractie;
  }

  /* Cu semnul unității, pentru locurile unde stă un singur număr singur. */
  function scrieCuSemn(mm, unitate) {
    var s = scrie(mm, unitate);
    if (s === '') return '';
    var uu = u(unitate);
    return uu.cod === 'mm' ? s + ' ' + uu.semn : s + uu.semn;
  }

  /* ---------- cititul ---------- */

  /* Fracțiile scrise cu un singur semn. Cineva care lucrează în țoli le are
     pe tastatură sau le lipește dintr-un document, și n-are de ce să afle
     că aplicația nu le știe. */
  var FRACTII = {
    '½': 0.5, '¼': 0.25, '¾': 0.75,
    '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 0.1,
    '⅓': 1 / 3, '⅔': 2 / 3,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
    '⅙': 1 / 6, '⅚': 5 / 6,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };

  /* Ce scrie omul -> milimetri. Întoarce null pentru ce nu se poate citi,
     nu zero: zero e o cotă, iar „nu înțeleg" nu e.

     În țoli se primesc toate felurile în care se scrie o cotă în atelier:
       22          22.5        22 1/2       22-1/2
       22 1/2"     22½         22 ½         1/2
     În milimetri se primește și virgula zecimală, fiindcă jumătate de
     Europă o scrie așa. */
  function citeste(text, unitate) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return null;

    var uu = u(unitate);

    /* semnele de unitate se aruncă: „22 1/2\"", „560 mm" */
    s = s.replace(/["″”]/g, ' ').replace(/\bmm\b/gi, ' ').replace(/\bin\b/gi, ' ').trim();

    if (uu.cod === 'mm') {
      var m = s.replace(',', '.');
      if (!/^-?\d*\.?\d+$/.test(m)) return null;
      var v = Number(m);
      return isFinite(v) ? v : null;
    }

    var semn = 1;
    if (s.charAt(0) === '-') { semn = -1; s = s.slice(1).trim(); }
    else if (s.charAt(0) === '+') { s = s.slice(1).trim(); }

    /* fracțiile dintr-un singur semn se desfac în „ a/b " */
    s = s.replace(/[½¼¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, function (c) {
      return ' ' + FRACTII[c] + ' ';
    });

    /* „22-1/2" e același lucru cu „22 1/2" — cratima leagă, nu scade */
    s = s.replace(/(\d)\s*-\s*(\d)/g, '$1 $2');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return null;

    var bucati = s.split(' ');
    if (bucati.length > 2) return null;

    var total = 0;
    for (var i = 0; i < bucati.length; i++) {
      var b = bucati[i];
      var f = /^(\d+)\/(\d+)$/.exec(b);
      if (f) {
        var jos = Number(f[2]);
        if (!jos) return null;
        total += Number(f[1]) / jos;
      } else if (/^\d*\.?\d+$/.test(b)) {
        total += Number(b);
      } else {
        return null;
      }
    }

    return isFinite(total) ? semn * total * TOL : null;
  }

  /* Cât de fin se poate scrie în casetele de formular. În milimetri pasul
     era 0,5 sau 1; în țoli, a scrie „0.1" într-o casetă de țoli n-are
     niciun înțeles. */
  function pasFormular(unitate) {
    return u(unitate).cod === 'mm' ? 0.5 : 1 / 16;
  }

  /* Cota pentru o MASINA, nu pentru un om: numar, nu fractie.

     Fisierul CSV pleaca la programul de debitare al celui care taie, si
     acolo „22 1/2" nu e un numar — ar cadea la citire sau, mai rau, ar fi
     citit ca 22. Dar nici milimetrii nu sunt raspunsul pentru un atelier
     care lucreaza in toli: masina lui e setata pe toli. Deci: acelasi
     numar, in unitatea atelierului, cu zecimale. */
  function pentruMasina(mm, unitate) {
    var v = Number(mm);
    if (!isFinite(v)) return '';
    if (u(unitate).cod === 'mm') return String(Math.round(v * 10) / 10);
    /* patru zecimale: 1/16 de tol e 0,0625, deci patru ajung cu prisosinta
       si nu lasa cozi din virgula mobila */
    return String(Math.round(v / TOL * 1e4) / 1e4);
  }

  return {
    TOL: TOL,
    pentruMasina: pentruMasina,
    UNITATI: UNITATI,
    unitatea: u,
    pas: pas,
    pasFormular: pasFormular,
    rotunjeste: rotunjeste,
    esteExact: esteExact,
    scrie: scrie,
    scrieCuSemn: scrieCuSemn,
    citeste: citeste
  };
});
