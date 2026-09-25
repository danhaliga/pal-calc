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
