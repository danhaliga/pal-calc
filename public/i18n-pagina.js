/* Limba paginii, pentru scripturile din browser.

   Serverul pune in pagina doar bucatile de catalog de care are nevoie pagina
   (<script type="application/json" id="i18n">). Aici se lasa la indemana o
   functie scurta: T('cheie', { param: valoare }).

   Catalogul se citeste la prima folosire, nu la incarcare: asa nu conteaza
   daca scriptul asta vine inaintea sau in urma elementului cu datele.

   Fara catalog - pe o pagina fara scripturi - T intoarce cheia, ca sa se vada
   ce lipseste, nu un text gol. */
(function () {
'use strict';

var gata = null;

function porneste() {
  var lang = document.documentElement.lang || 'ro';
  var el = document.getElementById('i18n');

  if (el && window.PalI18n) {
    try {
      var pachet = JSON.parse(el.textContent);
      window.PalI18n.inregistreaza(lang, pachet.catalog || {});
      if (pachet.ro && lang !== 'ro') window.PalI18n.inregistreaza('ro', pachet.ro);
      return window.PalI18n.creeaza(lang);
    } catch (e) { /* mergem mai departe cu cheile brute */ }
  }

  var brut = function (cheie) { return cheie; };
  brut.lang = lang;
  brut.dir = document.documentElement.dir || 'ltr';
  brut.numar = function (v) { return String(v); };
  brut.are = function () { return false; };
  return brut;
}

window.T = function (cheie, params) {
  if (!gata) gata = porneste();
  return gata(cheie, params);
};

/* insusirile se citesc tot lenes, prin proprietati calculate */
['lang', 'dir'].forEach(function (nume) {
  Object.defineProperty(window.T, nume, {
    get: function () { if (!gata) gata = porneste(); return gata[nume]; }
  });
});
window.T.numar = function (v, z) { if (!gata) gata = porneste(); return gata.numar(v, z); };
window.T.are = function (c) { if (!gata) gata = porneste(); return gata.are(c); };
})();
