/* ============================================================
   Adresa unui articol, făcută din titlul lui.

   Stă aici, nu lângă rute, din două motive: e o funcție curată, care se
   poate proba fără să deschidă baza de date; și pagina de editare o poate
   chema în browser ca să arate adresa în timp ce omul scrie titlul.

   Diacriticele se duc pe litera de bază. Fără asta „poliță" ar ieși
   „poli-", iar două articole diferite ar putea ajunge la aceeași adresă.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalSlug = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Ce nu se descompune singur prin NFD: româna cu virguliță, nemțescul ß,
     nordicele, poloneza. Lista e scurtă înadins — restul se rezolvă prin
     normalizare. */
  var APARTE = {
    'ș': 's', 'Ș': 'S', 'ț': 't', 'Ț': 'T',
    'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'ø': 'o', 'Ø': 'O',
    'å': 'a', 'Å': 'A', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D',
    'ı': 'i', 'İ': 'I', 'œ': 'oe', 'Œ': 'OE'
  };

  function faSlug(text, maxim) {
    var s = String(text == null ? '' : text);

    s = s.replace(/[șȘțȚßæÆøØåÅłŁđĐıİœŒ]/g, function (c) { return APARTE[c] || c; });

    /* Doar semnele combinate din blocul latin-grec-chirilic (U+0300–U+036F).
       Înadins NU atingem restul: în hindi și în thailandeză semnele de
       vocală sunt litere, nu podoabe, iar ștergerea lor ar schimba cuvântul. */
    s = s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;

    /* Păstrăm orice LITERĂ sau CIFRĂ, în orice scriere, nu doar a–z. Altfel
       un titlu chinezesc, arab sau rusesc dă un slug gol și toate articolele
       din limba aia ajung „articol-2", „articol-3". Adresele cu litere
       proprii se scriu procentual pe fir și se văd normal în bara browserului.
       Ce NU e literă sau cifră — bară, semn de întrebare, diez, procent,
       punct, spațiu — cade aici, deci slugul nu poate ieși din drumul lui.

       `\p{M}` intră în listă fiindcă normalizarea de mai sus a desfăcut
       literele: în arabă hamza, în hindi și în thailandeză semnele de vocală
       rămân separat și sunt semne combinate, nu litere. Fără ele, „قائمة"
       ieșea „قاي-مة" și „รายการตัด" ieșea „รายการต-ด". La latină nu strică:
       acolo semnele au fost deja șterse. */
    s = s.toLowerCase()
         .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
         .replace(/^-+|-+$/g, '');

    /* Înapoi în forma compusă. Browserul trimite adresa în NFC, iar în bază
       trebuie să stea la fel, altfel căutarea după slug nu găsește nimic. */
    s = s.normalize ? s.normalize('NFC') : s;

    var n = maxim || 80;
    if (s.length <= n) return s;
    /* tăiem pe cratimă, ca să nu rămână un cuvânt ciuntit în adresă */
    var taiat = s.slice(0, n);
    var cratima = taiat.lastIndexOf('-');
    return (cratima > n * 0.5 ? taiat.slice(0, cratima) : taiat).replace(/-+$/, '');
  }

  return { faSlug: faSlug };
});
