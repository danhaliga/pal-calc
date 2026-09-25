/* Selectorul de decoruri: caută în catalogul Egger / Kronospan și
   potrivește grosimile de PAL și de cant cu ce se face în decorul ales. */
(function () {
'use strict';

var cache = {};

function ia(brand) {
  if (cache[brand]) return Promise.resolve(cache[brand]);
  return fetch('/api/catalog?brand=' + encodeURIComponent(brand))
    .then(function (r) { return r.json(); })
    .then(function (j) { cache[brand] = j; return j; });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m];
  });
}

function init(root) {
  var codInput = root.querySelector('input[type="hidden"]');
  var buton = root.querySelector('.decor-buton');
  var panou = root.querySelector('.decor-panou');
  var cautare = panou.querySelector('.decor-cauta');
  var grupSel = panou.querySelector('.decor-grup');
  var grila = panou.querySelector('.decor-grila');
  var contor = panou.querySelector('.decor-contor');

  var brandSel = document.getElementById(root.dataset.brand || '');
  var palSel = document.getElementById(root.dataset.pal || '');
  var cantGrosSel = document.getElementById(root.dataset.cantGros || '');
  var cantSubtireSel = document.getElementById(root.dataset.cantSubtire || '');

  var date = null;
  var ales = codInput.value || '';

  function brand() { return brandSel ? brandSel.value : (root.dataset.brandFix || 'Egger'); }

  function decorAles() {
    if (!date || !ales) return null;
    return date.decoruri.filter(function (d) { return d.cod === ales; })[0] || null;
  }

  /* păstrează doar grosimile care există în decorul ales, fără să piardă alegerea curentă */
  function potriveste(sel, valori, eticheta) {
    if (!sel || !valori || !valori.length) return;
    var curent = sel.value;
    sel.innerHTML = valori.map(function (v) {
      return '<option value="' + v + '">' + v + (eticheta || '') + '</option>';
    }).join('');
    if (valori.indexOf(Number(curent)) !== -1 || valori.indexOf(curent) !== -1) sel.value = curent;
  }

  function aplicaDisponibil() {
    var d = decorAles();
    if (!d) return;
    potriveste(palSel, d.gros, ' mm');
    var canturi = (d.cant && d.cant.length) ? d.cant : (date.cantStandard || [0.4, 0.8, 1, 2]);
    potriveste(cantGrosSel, canturi, ' mm');
    potriveste(cantSubtireSel, canturi, ' mm');
  }

  function aratButon() {
    var d = decorAles();
    if (!d) {
      buton.innerHTML = '<span class="decor-sw" style="background:#cfd6dd"></span>' +
                        '<span>Alege decorul…</span>';
      return;
    }
    buton.innerHTML = '<span class="decor-sw" style="background:' + esc(d.hex) + '"></span>' +
      '<span><b>' + esc(d.nume) + '</b><small>' + esc(d.cod) + ' · ' + esc(d.grup) + '</small></span>';
  }

  function deseneaza() {
    if (!date) return;
    var q = (cautare.value || '').trim().toLowerCase();
    var grup = grupSel.value;
    var lista = date.decoruri.filter(function (d) {
      if (grup && d.grup !== grup) return false;
      if (!q) return true;
      return d.cod.toLowerCase().indexOf(q) !== -1 ||
             d.nume.toLowerCase().indexOf(q) !== -1;
    });

    contor.textContent = lista.length + ' din ' + date.decoruri.length + ' decoruri';
    grila.innerHTML = lista.slice(0, 240).map(function (d) {
      return '<button type="button" class="decor-optiune' + (d.cod === ales ? ' ales' : '') +
        '" data-cod="' + esc(d.cod) + '" title="' + esc(d.nume + ' — ' + d.cod) + '">' +
        '<span class="decor-sw mare" style="background:' + esc(d.hex) + '"></span>' +
        '<span class="decor-nume">' + esc(d.nume) + '</span>' +
        '<span class="decor-cod">' + esc(d.cod) + '</span></button>';
    }).join('');
    if (lista.length > 240) {
      grila.innerHTML += '<p class="hint" style="grid-column:1/-1">Încă ' + (lista.length - 240) +
        ' decoruri — caută după nume sau cod.</p>';
    }
  }

  function incarca() {
    return ia(brand()).then(function (j) {
      date = j;
      grupSel.innerHTML = '<option value="">toate grupele</option>' +
        j.grupuri.map(function (g) {
          return '<option value="' + esc(g.nume) + '">' + esc(g.nume) + ' (' + g.n + ')</option>';
        }).join('');
      deseneaza();
      aratButon();
      aplicaDisponibil();
    });
  }

  buton.addEventListener('click', function () {
    panou.classList.toggle('hidden');
    if (!panou.classList.contains('hidden')) {
      incarca().then(function () { cautare.focus(); });
    }
  });

  cautare.addEventListener('input', deseneaza);
  grupSel.addEventListener('change', deseneaza);

  grila.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cod]');
    if (!b) return;
    ales = b.dataset.cod;
    codInput.value = ales;
    aratButon();
    aplicaDisponibil();
    panou.classList.add('hidden');
  });

  if (brandSel) {
    brandSel.addEventListener('change', function () {
      ales = ''; codInput.value = '';
      cache = {};
      incarca();
    });
  }

  incarca();
}

document.querySelectorAll('[data-decor]').forEach(init);
})();
