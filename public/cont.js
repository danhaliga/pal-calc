/* Pagina contului: un singur lucru de făcut în browser.

   Prima alegere din selectorul de unitate e „după țară”, iar între paranteze
   scrie care e unitatea aia. Dacă omul schimbă țara și nu se schimbă și
   paranteza, scrie acolo unitatea țării de dinainte — adică o minciună pe
   care o vede după ce salvează.

   Nu se schimbă NIMIC altceva: unitatea rămâne cea aleasă de om, iar dacă
   n-a ales-o, o hotărăște serverul din țară. Aici se scrie doar ce iese. */
(function () {
'use strict';

var tara = document.getElementById('tara');
var unitate = document.getElementById('unitate');
if (!tara || !unitate) return;

var dupaTara = unitate.querySelector('[data-dupa-tara]');
if (!dupaTara) return;

/* Țările care lucrează în țoli, puse în pagină de server. Fără ele mergem
   mai departe cu milimetri: aceeași valoare pe care ar da-o și serverul
   pentru o țară pe care n-o are pe listă. */
var inToli = {};
try {
  var el = document.getElementById('page-data');
  if (el) inToli = (JSON.parse(el.textContent) || {}).inToli || {};
} catch (e) { /* mergem cu milimetri */ }

function scrie() {
  var u = inToli[tara.value] ? 'inch' : 'mm';
  dupaTara.textContent = window.T('cont.unitateDupaTara', { unitate: window.T('unitate.' + u) });
}

tara.addEventListener('change', scrie);
scrie();
})();
