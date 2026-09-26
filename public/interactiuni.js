/* Interacțiuni mărunte, pe toate paginile.

   Politica de securitate a paginii (CSP) nu permite scripturi inline, deci
   atributele de tip onclick nu se execută niciodată. Tot ce era acolo se scrie
   aici, prin atribute de date:

     data-comuta="idElement"   arată sau ascunde elementul
     data-confirma="întrebare" cere confirmare înainte de trimiterea formularului
     data-trimite-la-schimbare trimite formularul când se schimbă valoarea
     data-tipareste            deschide fereastra de tipărire
*/
(function () {
'use strict';

document.addEventListener('click', function (e) {
  var comuta = e.target.closest('[data-comuta]');
  if (comuta) {
    var tinta = document.getElementById(comuta.dataset.comuta);
    if (tinta) {
      tinta.classList.toggle('hidden');
      if (!tinta.classList.contains('hidden')) {
        var primul = tinta.querySelector('input, select, textarea');
        if (primul) primul.focus();
      }
    }
    return;
  }

  var tipar = e.target.closest('[data-tipareste]');
  if (tipar) { window.print(); return; }

  var intreaba = e.target.closest('[data-confirma]');
  if (intreaba && !window.confirm(intreaba.dataset.confirma)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('change', function (e) {
  var camp = e.target.closest('[data-trimite-la-schimbare]');
  if (camp && camp.form) camp.form.submit();
});
})();
