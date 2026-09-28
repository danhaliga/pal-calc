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
  var numeInput = document.getElementById(root.dataset.nume || '');

  var date = null;
  var ales = codInput.value || '';
  /* Ce-am scris NOI ultima dată în câmpul de nume. Atât timp cât omul n-a
     pus mâna pe el, îl rescriem la fiecare decor ales; de cum scrie ceva
     al lui, ne dăm la o parte. */
  var numePus = numeInput ? numeInput.value : '';

  function brand() { return brandSel ? brandSel.value : (root.dataset.brandFix || 'Egger'); }

  function decorAles() {
    if (!date || !ales) return null;
    return date.decoruri.filter(function (d) { return d.cod === ales; })[0] || null;
  }

  /* păstrează doar grosimile care există în decorul ales, fără să piardă alegerea curentă */
  /* Ca `potriveste`, dar nu aruncă nicio grosime: cele care nu sunt pe stoc la
     decorul ales rămân alegibile, doar însemnate. */
  function potrivesteCant(sel, toate, peStoc) {
    if (!sel || !toate || !toate.length) return;
    var curent = sel.value;
    var peComanda = T('comandaNoua.cantPeComanda');
    sel.innerHTML = toate.map(function (v) {
      var afara = peStoc.length && peStoc.indexOf(v) === -1;
      return '<option value="' + v + '">' + v + ' mm' +
             (afara ? ' · ' + esc(peComanda) : '') + '</option>';
    }).join('');
    if (toate.indexOf(Number(curent)) !== -1) sel.value = curent;
  }

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
    /* Grosimile de cant NU se filtrează după catalog. Catalogul știe doar ce
       ține furnizorul pe stoc la decorul ăla; atelierul folosește și 0.4 și 1,
       iar dacă le ascundem nu se mai pot alege deloc. Le arătăm pe toate și
       marcăm care sunt pe stoc. */
    var peStoc = (d.cant && d.cant.length) ? d.cant : [];
    /* Grosimea deja aleasa ramane pe lista chiar daca nu mai e in fabricatie:
       altfel un corp vechi si-ar pierde cantul la prima atingere. */
    var acum = [cantGrosSel, cantSubtireSel].map(function (s) { return s ? +s.value : 0; });
    var toate = (date.cantStandard || [0.8, 1, 1.3, 1.5, 2]).slice();
    peStoc.forEach(function (c) { if (toate.indexOf(c) === -1) toate.push(c); });
    acum.forEach(function (c) { if (c && toate.indexOf(c) === -1) toate.push(c); });
    toate.sort(function (a, b) { return a - b; });
    potrivesteCant(cantGrosSel, toate, peStoc);
    potrivesteCant(cantSubtireSel, toate, peStoc);
  }

  /* Numele materialului e o etichetă, nu o dată de care omul dispune:
     nimeni nu știe cum se cheamă placa înainte s-o aleagă din catalog. */
  function punNume(d) {
    if (!numeInput || !d) return;
    if (numeInput.value && numeInput.value !== numePus) return;
    numePus = d.nume;
    numeInput.value = numePus;
  }

  function aratButon() {
    var d = decorAles();
    if (!d) {
      buton.innerHTML = '<span class="decor-sw" style="background:#cfd6dd"></span>' +
                        '<span>' + esc(T('decor.alege')) + '</span>';
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

    contor.textContent = T('decor.contor', { n: lista.length, total: date.decoruri.length });
    grila.innerHTML = lista.slice(0, 240).map(function (d) {
      return '<button type="button" class="decor-optiune' + (d.cod === ales ? ' ales' : '') +
        '" data-cod="' + esc(d.cod) + '" title="' + esc(d.nume + ' — ' + d.cod) + '">' +
        '<span class="decor-sw mare" style="background:' + esc(d.hex) + '"></span>' +
        '<span class="decor-nume">' + esc(d.nume) + '</span>' +
        '<span class="decor-cod">' + esc(d.cod) + '</span></button>';
    }).join('');
    if (lista.length > 240) {
      grila.innerHTML += '<p class="hint" style="grid-column:1/-1">' +
        esc(T('decor.incaN', { n: lista.length - 240 })) + '</p>';
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
    punNume(decorAles());
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
