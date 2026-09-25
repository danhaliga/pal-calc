/* Lista de corpuri: stergere cu confirmare. */
(function () {
'use strict';
var DATA = JSON.parse(document.getElementById('page-data').textContent);

document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-delete]');
  if (!btn) return;
  var id = btn.dataset.delete;
  if (!confirm('Ștergi corpul „' + btn.dataset.name + '”? Acțiunea nu poate fi anulată.')) return;

  btn.disabled = true;
  fetch('/api/corps/' + id, {
    method: 'DELETE',
    headers: { 'x-csrf-token': DATA.csrf }
  }).then(function (r) {
    if (!r.ok) throw new Error('nu s-a putut șterge');
    /* în listă corpul e un card, în comandă un rând de tabel */
    var rand = btn.closest('.corp-card') || btn.closest('tr');
    if (rand && rand.closest('table')) { location.reload(); return; }
    if (rand) rand.remove();
    if (!document.querySelector('.corp-card')) location.reload();
  }).catch(function () {
    btn.disabled = false;
    alert('Corpul nu a putut fi șters.');
  });
});
})();
