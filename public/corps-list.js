/* Lista de corpuri: stergere cu confirmare.
   Textele vin din pagina, in limba ei: scripturile nu tin texte in ele. */
(function () {
'use strict';
var DATA = JSON.parse(document.getElementById('page-data').textContent);
var T = DATA.texte || {};

document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-delete]');
  if (!btn) return;
  var id = btn.dataset.delete;
  var intrebare = String(T.confirmaStergere || 'Delete?').replace('{nume}', btn.dataset.name);

  /* NU `confirm()`. Ala e o fereastra a browserului, iar browserul are voie
     s-o opreasca — si o opreste, in panourile din aplicatii si in
     webview-uri. Cand o opreste, `confirm()` intoarce false fara sa intrebe
     pe nimeni: butonul de stergere nu facea NIMIC, tacut, si omul credea ca
     e stricata aplicatia. `PalIntreaba` e o fereastra a paginii. */
  window.PalIntreaba(intrebare, function () { sterge(btn, id); });
});

function sterge(btn, id) {
  btn.disabled = true;
  fetch('/api/corps/' + id, {
    method: 'DELETE',
    headers: { 'x-csrf-token': DATA.csrf }
  }).then(function (r) {
    if (!r.ok) throw new Error('nu s-a putut sterge');
    /* in lista corpul e un card, in comanda un rand de tabel */
    var rand = btn.closest('.corp-card') || btn.closest('tr');
    if (rand && rand.closest('table')) { location.reload(); return; }
    if (rand) rand.remove();
    if (!document.querySelector('.corp-card')) location.reload();
  }).catch(function () {
    btn.disabled = false;
    alert(T.eroareStergere || 'Delete failed.');
  });
}
})();
