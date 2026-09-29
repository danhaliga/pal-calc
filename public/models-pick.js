/* Catalogul de modele: filtrarea pe categorii. */
(function () {
'use strict';

var filtre = document.getElementById('filtre');
if (!filtre) return;

filtre.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-cat]');
  if (!btn) return;

  var cat = btn.dataset.cat;
  Array.prototype.forEach.call(filtre.querySelectorAll('[data-cat]'), function (b) {
    b.classList.toggle('on', b === btn);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.grup'), function (g) {
    var arata = cat === 'toate' || g.dataset.cat === cat || g.dataset.cat === 'gol';
    g.classList.toggle('ascuns', !arata);
  });
});
})();

/* Cardurile, cu setările ținute minte ale omului.

   Pe server cardul se desenează din modelul curat: serverul nu știe ce
   și-a salvat omul în browser. Dar corpul creat vine cu setările puse
   peste model (soclul, materialul, rosturile...), iar un card care arată
   altceva decât corpul care iese e o poză care minte. Aici se redesenează
   cu aceeași regulă pe care o folosește editorul (PalModels.aplicaSetari). */
(function () {
'use strict';

var CHEIE_SETARI = 'pal-calc.setari-corp';   /* aceeași ca în app.js */
var sursa = document.getElementById('modele-data');
if (!sursa || !window.PalModels || !window.PalCalc) return;

var setari = null;
try {
  var brut = window.localStorage.getItem(CHEIE_SETARI);
  if (brut) setari = JSON.parse(brut);
} catch (e) { setari = null; }
if (!setari || !setari.grupe || !setari.val) return;

var date;
try { date = JSON.parse(sursa.textContent); } catch (e) { return; }

(date.modele || []).forEach(function (m) {
  var card = document.querySelector('.model-card[data-model="' + m.id + '"]');
  if (!card) return;
  var p = JSON.parse(JSON.stringify(m.params));
  var schimbat = window.PalModels.aplicaSetari(p, setari, {
    cheiModel: m.cheiModel || [], pePodea: m.pePodea, matFixat: date.matFixat
  });
  if (!schimbat) return;
  try {
    var sk = card.querySelector('.sk-wrap');
    if (sk) sk.innerHTML = window.PalModels.sketch(p);
    var dim = card.querySelector('.model-dim');
    if (dim) dim.textContent = p.W + ' × ' + p.H + ' × ' + p.D + ' mm';
  } catch (e) { /* un card care nu se poate redesena rămâne cum a venit */ }
});
})();
