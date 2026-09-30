/* Pagina „Prestatori": filtrele din listă și, pe pagina unei firme,
   titlul mailului care urmează comanda aleasă. */
(function () {
  'use strict';

  /* ---------- filtrele ---------- */
  var bara = document.getElementById('prestFiltre');
  var grila = document.getElementById('prestGrila');
  if (bara && grila) {
    bara.hidden = false;
    var stare = { regiune: '', cnc: false, excel: false, egger: false, toti: false };
    var carduri = Array.prototype.slice.call(grila.querySelectorAll('.prest-card'));
    var nr = document.getElementById('prestNr');
    var aplica = function () {
      var n = 0;
      carduri.forEach(function (c) {
        var d = c.dataset;
        var da = (stare.toti || d.recomandat === '1') && (!stare.regiune || d.regiune === stare.regiune) &&
                 (!stare.cnc || d.cnc === '1') && (!stare.excel || d.excel === '1') && (!stare.egger || d.egger === '1');
        c.hidden = !da;
        if (da) n++;
      });
      if (nr) nr.textContent = String(n);
      bara.querySelectorAll('[data-regiune]').forEach(function (b) { b.classList.toggle('on', b.dataset.regiune === stare.regiune); });
      bara.querySelectorAll('[data-filtru]').forEach(function (b) { b.classList.toggle('on', !!stare[b.dataset.filtru]); });
    };
    bara.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.regiune !== undefined) stare.regiune = b.dataset.regiune;
      else if (b.dataset.filtru) stare[b.dataset.filtru] = !stare[b.dataset.filtru];
      aplica();
    });
    aplica();
  }

  /* ---------- titlul mailului urmează comanda ---------- */
  var sel = document.getElementById('alegeComanda');
  var form = document.getElementById('formTrimite');
  if (sel && form) {
    var numeDe = function () { var o = sel.options[sel.selectedIndex]; return o ? o.getAttribute('data-nume') : ''; };
    var vechi = numeDe();
    sel.addEventListener('change', function () {
      var nou = numeDe();
      ['subiect', 'text'].forEach(function (k) {
        var el = form.elements[k];
        if (el && vechi) el.value = el.value.split(vechi).join(nou);
      });
      vechi = nou;
    });
  }
})();
