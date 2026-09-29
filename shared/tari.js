/* ============================================================
   Țările.

   De ce e nevoie de ele: unitatea de măsură. Un atelier din Statele Unite
   nu taie corpuri de 720 mm, ci de 34½ țoli, iar dacă îi arătăm milimetri
   se uită la aplicație ca la o unealtă străină. Țara spune unitatea, și de
   la ea pornesc mai târziu și formatele de coală și catalogul de modele.

   NUMELE ȚĂRILOR NU SE TRADUC AICI. Două sute de țări ori treizeci de
   limbi ar fi șase mii de nume scrise de mână, adică șase mii de greșeli
   posibile într-o limbă pe care nu o citește nimeni din atelier. Le dă
   `Intl.DisplayNames`, care le are deja, în toate cele treizeci.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalTari = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ISO 3166-1 alpha-2. Sunt și câteva teritorii (HK, TW, PR) care au piață
     de mobilă a lor și oameni care ar putea deschide aplicația. */
  var CODURI = (
    'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ ' +
    'CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI ' +
    'FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM ' +
    'JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG ' +
    'MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK ' +
    'PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY ' +
    'SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'
  ).split(' ');

  var ARE_COD = {};
  CODURI.forEach(function (c) { ARE_COD[c] = true; });

  /* Unde se lucrează în țoli, LA MOBILĂ. Nu e aceeași listă cu „unde se
     folosește sistemul imperial":

       US  corpul de bucătărie e 34½ x 24 țoli, lățimile în pași de 3 țoli
       CA  atelierele vând corpuri în cotele americane, chiar dacă legea e metrică
       LR  sistem imperial
       MM  sistem imperial

     GB NU e pe listă, deși toată lumea se așteaptă. La atelier britanicii
     lucrează în milimetri — carcasa e 910 mm, nu 36 de țoli. Țolii îi
     folosesc afară din atelier. De-aia unitatea aleasă după țară e o
     propunere, nu o hotărâre: omul o schimbă din contul lui. */
  var IN_TOLI = { US: true, CA: true, LR: true, MM: true };

  var UNITATI = ['mm', 'inch'];

  function areTara(cod) {
    return !!ARE_COD[String(cod || '').trim().toUpperCase()];
  }

  function normalizeaza(cod) {
    var c = String(cod || '').trim().toUpperCase();
    return ARE_COD[c] ? c : null;
  }

  /* Unitatea propusă pentru o țară. Țară necunoscută sau lipsă: milimetri,
     fiindcă așa lucrează restul lumii. */
  function unitatePentru(tara) {
    return IN_TOLI[normalizeaza(tara)] ? 'inch' : 'mm';
  }

  /* „en-US,en;q=0.9" -> „US". Ce are browserul în antet e tot ce știm despre
     locul de unde vine omul înainte să ne spună el. Ajunge ca să propunem. */
  function dinAntet(antet) {
    if (!antet) return null;
    var bucati = String(antet).split(',');
    for (var i = 0; i < bucati.length; i++) {
      var etichete = bucati[i].split(';')[0].trim().split('-');
      for (var j = 1; j < etichete.length; j++) {
        /* regiunea e eticheta de două litere: „sr-Latn-RS" -> „RS" */
        var e = etichete[j].trim().toUpperCase();
        if (e.length === 2 && ARE_COD[e]) return e;
      }
    }
    return null;
  }

  /* Numele țării în limba paginii. Dacă mediul nu are datele (ICU tăiat),
     rămâne codul — „DE" e mai bun decât nimic și nu dărâmă pagina. */
  function numeTara(cod, lang) {
    var c = normalizeaza(cod);
    if (!c) return '';
    try {
      var n = new Intl.DisplayNames([lang || 'en'], { type: 'region' }).of(c);
      return n || c;
    } catch (e) {
      return c;
    }
  }

  /* Lista pentru un selector, în ordinea alfabetului limbii cerute —
     alfabetul, nu codul ISO: în română Ungaria vine după Austria, iar
     „HU" înainte de „AT" n-ar găsi-o nimeni. */
  function lista(lang) {
    var out = CODURI.map(function (c) {
      return { cod: c, nume: numeTara(c, lang), unitate: unitatePentru(c) };
    });
    var compara;
    try {
      compara = new Intl.Collator(lang || 'en').compare;
    } catch (e) {
      compara = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
    }
    out.sort(function (a, b) { return compara(a.nume, b.nume); });
    return out;
  }

  return {
    CODURI: CODURI,
    UNITATI: UNITATI,
    IN_TOLI: IN_TOLI,
    areTara: areTara,
    normalizeaza: normalizeaza,
    unitatePentru: unitatePentru,
    dinAntet: dinAntet,
    numeTara: numeTara,
    lista: lista
  };
});
