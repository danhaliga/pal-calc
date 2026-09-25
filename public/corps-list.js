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
    var card = btn.closest('.corp-card');
    if (card) card.remove();
    if (!document.querySelector('.corp-card')) location.reload();
  }).catch(function () {
    btn.disabled = false;
    alert('Corpul nu a putut fi șters.');
  });
});
})();
