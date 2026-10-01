/* Editorul de corp: formular + vedere 3D + lista de piese.
   Portat din calculator-debitare.html, adaptat pentru cont si plata.

   Regula de aur: coloanele platite (cant, taiere) vin EXCLUSIV de la server
   (GET /api/corps/:id/pieces). calc() ruleaza local doar pentru 3D si cotele finite. */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
var DATA = JSON.parse($('page-data').textContent);
var CORP_ID = DATA.corpId;
var params = DATA.params;
var paid = !!DATA.paid;

var fields = ['nume','tip','W','H','D','W2','orb','constr','soclu','picioare','traverse','t','cg','cs','spate','tp','faraFront','usiSticla','jolly','imbinare','capatLaterala','nUsi','montaj','balama','supr','hSine',
              'rm','ri','rinc','hUsi','hNisa','nDsp','nPol','jp','rp','nSer','sertareJos','hFront','hCutie','jg','ts','lg','maner','manerDir','manerPoz','manerL',
              'pBuc','pFibra','pcL1','pcL2','pcl1','pcl2'];

/* Compartimentele care primesc uși. Bife, nu un câmp de scris: numerele se
   schimbă cu fiecare montant adăugat, iar o listă scrisă de mână rămâne în
   urmă fără ca nimeni să observe. Se văd doar când e cel puțin un montant —
   fără el corpul are un singur compartiment și n-ai ce alege. */
function randeazaCompUsi() {
  var box = $('compUsiBox'), lista = $('compUsiLista');
  if (!box || !lista) return;

  var comp = (+params.nDsp || 0) + 1;
  var areRost = comp > 1 && (+params.nUsi || 0) > 0;
  box.classList.toggle('hidden', !areRost);
  if (!areRost) return;

  var alese = window.PalCalc.compartimenteAlese(params.compUsi, comp);
  var html = '';
  for (var i = 0; i < comp; i++) {
    html += '<label class="check"><input type="checkbox" data-comp="' + i + '"' +
            (alese.indexOf(i) !== -1 ? ' checked' : '') + '> ' + (i + 1) + '</label>';
  }
  lista.innerHTML = html;
}

function citesteCompUsi() {
  var comp = (+params.nDsp || 0) + 1;
  var bifate = [];
  document.querySelectorAll('#compUsiLista input[data-comp]').forEach(function (cb) {
    if (cb.checked) bifate.push(+cb.dataset.comp + 1);
  });
  /* Toate bifate, sau niciuna, înseamnă același lucru: „nu alege nimic".
     Fără asta, debifarea ultimului compartiment ar lăsa corpul fără uși
     dintr-o bifă, în loc să scrie 0 la numărul lor. */
  params.compUsi = (!bifate.length || bifate.length === comp) ? '' : bifate.join(',');
}

/* ce câmpuri are sens să vadă utilizatorul, în funcție de tipul corpului */
function aplicaTip() {
  var tip = params.tip || 'drept';
  var colt = tip === 'colt-L' || tip === 'colt-diagonal';
  var atipic = tip === 'atipic';
  var piesa = tip === 'piesa';
  var arata = function (id, da) { var el = $(id); if (el) el.classList.toggle('hidden', !da); };
  /* Fișele CNC pe piesă sunt ale corpului de sub scară. */
  arata('fiseCnc', atipic);

  /* O piesă răzleață n-are uși, polițe, sertare, montanți sau spate. Ce nu
     are ce căuta acolo se ascunde, nu se lasă gri: un formular plin de
     câmpuri fără rost e mai rău decât unul scurt. */
  arata('fsPiesa', piesa);
  /* configurările rapide sunt ale corpului de jos: drept și nu mai înalt de 1 m */
  arata('fsRapid', !piesa && (DATA.configRapide || []).length > 0);
  if (piesa) {
    var tbPe = $('pieseExtraTabel');
    if (tbPe && tbPe.children.length !== (params.pieseExtra || []).length) randeazaPieseExtra();
  }
  arata('fsUsi', !piesa);
  arata('fsMontanti', !piesa);
  arata('fsPolite', !piesa);
  arata('fsSertare', !piesa);
  arata('randSpate', !piesa);

  arata('wrapW2', colt);
  arata('wrapOrb', tip === 'colt-orb');
  arata('wrapConstr', !colt && !atipic && !piesa);
  /* Suprapunerea și șinele sunt numai ale ușilor glisante. La balamale
     n-au niciun înțeles, deci nu stau în drum. */
  /* Cum și unde se pune mânerul n-au niciun înțeles când nu se pune. */
  arata('randManer', !!+params.maner);

  var glisant = params.montaj === 'glisant';
  arata('wrapSupr', glisant);
  arata('wrapSine', glisant);
  /* Tot ce ține de balamale și de zonele de uși n-are rost la glisante. */
  var balamaEl = $('balama'); if (balamaEl) balamaEl.closest('label').classList.toggle('hidden', glisant);
  arata('conturBox', atipic);
  var wrapW = $('W') ? $('W').closest('label') : null;
  var wrapH = $('H') ? $('H').closest('label') : null;
  if (wrapW) wrapW.classList.toggle('hidden', atipic);
  if (wrapH) wrapH.classList.toggle('hidden', atipic);
  /* La o piesă, adâncimea e grosimea plăcii: vine din PAL, nu se scrie. */
  var wrapD = $('D') ? $('D').closest('label') : null;
  if (wrapD) wrapD.classList.toggle('hidden', piesa);

  $('labelW').textContent = T(piesa ? 'editor.lungimePiesa'
    : colt ? 'editor.laturaPerete1' : 'editor.latime');
  $('labelH').textContent = T(piesa ? 'editor.latimePiesa' : 'editor.inaltime');
  $('labelD').textContent = T((colt || atipic) ? 'editor.adancimeBrate' : 'editor.adancime');
  if (atipic) $('labelD').textContent = T('editor.adancimeCorp');

  var nota = $('notaColt');
  nota.classList.toggle('hidden', tip === 'drept');
  if (tip === 'colt-orb') {
    nota.textContent = T('editor.notaColtOrb');
  } else if (colt) {
    nota.textContent = T('editor.notaColtL');
  } else if (atipic) {
    nota.textContent = T('editor.notaAtipic');
    if (!params.contur || !params.contur.length) {
      params.contur = window.PalCalc.conturImplicit(+params.W || 800, +params.H || 720);
    }
    var tbody = $('conturTabel');
    if (!tbody || tbody.children.length !== params.contur.length) randeazaContur();
    else actualizeazaContur();
  }
}

/* ---------------- piesa simplă: celelalte piese din produs ----------------

   Ca la contur: rândurile se redesenează doar când se schimbă numărul lor,
   altfel câmpul în care scrii s-ar înlocui la fiecare tastă. */
var escPE = function (x) {
  return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
var CANT_OPT = [['-', 'editor.faraCant'], ['g', 'editor.cantGrosOpt'], ['s', 'editor.cantSubtireOpt']];
var FIBRA_OPT = [['L', 'editor.fibraPeLungime'], ['l', 'editor.fibraPeLatime'], ['-', 'editor.fibraOricum']];

function optiuni(lista, ales) {
  return lista.map(function (o) {
    return '<option value="' + o[0] + '"' + (o[0] === ales ? ' selected' : '') + '>' + escPE(T(o[1])) + '</option>';
  }).join('');
}

function randeazaPieseExtra() {
  var tbody = $('pieseExtraTabel');
  if (!tbody) return;
  var lista = params.pieseExtra || [];
  tbody.innerHTML = lista.map(function (r, i) {
    var num = function (camp, min, max) {
      return '<td class="c"><input class="dim" type="number" min="' + min + '" max="' + max + '" step="1" ' +
             'data-pe="' + i + '" data-camp="' + camp + '" value="' + (r[camp] == null ? '' : r[camp]) + '"></td>';
    };
    var sel = function (camp, lista2) {
      return '<td class="c"><select data-pe="' + i + '" data-camp="' + camp + '">' + optiuni(lista2, r[camp]) + '</select></td>';
    };
    return '<tr>' +
      '<td class="c" style="color:var(--muted)">' + (i + 2) + '</td>' +
      '<td><input data-pe="' + i + '" data-camp="nume" maxlength="60" value="' + escPE(r.nume || '') + '" ' +
        'placeholder="' + escPE(T('piesa.piesaSimplaNr', { n: i + 2 })) + '"></td>' +
      num('L', 20, 3000) + num('l', 20, 3000) + num('buc', 1, 999) +
      sel('cL1', CANT_OPT) + sel('cL2', CANT_OPT) + sel('cl1', CANT_OPT) + sel('cl2', CANT_OPT) +
      sel('fibra', FIBRA_OPT) +
      '<td class="c"><button type="button" class="mini danger" title="' + escPE(T('editor.stergePiesa')) +
        '" data-sterge-piesa="' + i + '">✕</button></td>' +
      '</tr>';
  }).join('');
}

/* O cotă scrisă pe jumătate (gol, 5 mm) nu pleacă la server: ar fi
   refuzată. Rândul se înroșește până e bun. */
function pieseExtraBune() {
  var bune = true;
  document.querySelectorAll('#pieseExtraTabel input[type=number]').forEach(function (el) {
    var v = +el.value, ok = el.value !== '' && v >= +el.min && v <= +el.max;
    el.classList.toggle('invalid', !ok);
    if (!ok) bune = false;
  });
  return bune;
}

function legaPieseExtra() {
  var tbody = $('pieseExtraTabel');
  if (!tbody) return;
  var schimba = function (e) {
    var i = e.target.dataset.pe;
    if (i === undefined) return;
    var camp = e.target.dataset.camp;
    var r = params.pieseExtra[+i];
    r[camp] = (camp === 'L' || camp === 'l' || camp === 'buc') ? +e.target.value : e.target.value;
    if (!pieseExtraBune()) return;
    render();
    scheduleSave();
  };
  tbody.addEventListener('input', schimba);
  tbody.addEventListener('change', schimba);
  tbody.addEventListener('click', function (e) {
    var i = e.target.dataset.stergePiesa;
    if (i === undefined) return;
    params.pieseExtra.splice(+i, 1);
    randeazaPieseExtra(); render(); scheduleSave();
  });
  $('piesaAdauga').onclick = function () {
    params.pieseExtra = params.pieseExtra || [];
    if (params.pieseExtra.length >= 99) return;
    var ultim = params.pieseExtra[params.pieseExtra.length - 1];
    params.pieseExtra.push(ultim
      ? { nume: '', L: ultim.L, l: ultim.l, buc: 1, cL1: ultim.cL1, cL2: ultim.cL2, cl1: ultim.cl1, cl2: ultim.cl2, fibra: ultim.fibra }
      : { nume: '', L: 600, l: 300, buc: 1, cL1: 'g', cL2: '-', cl1: '-', cl2: '-', fibra: 'L' });
    randeazaPieseExtra(); render(); scheduleSave();
  };
}

/* ---------------- sertare: împărțirea fronturilor ----------------

   `sertareH` ține fronturile de sus în jos („140,r,50%"): mm, „r" = restul
   (împărțit egal între toate „r"-urile) sau procent din tot frontul.
   `sertareC` ține cutiile; un loc gol = se calculează din front. Câtă vreme
   `sertareH` e gol, sertarele merg ca înainte, cu `hFront` și `hCutie`. */
var IMPARTIRI = {
  egale: function (n) { var r = []; for (var i = 0; i < n; i++) r.push('r'); return r.join(','); },
  unMic: function () { return '140,r,r'; },
  jumatate: function () { return '140,r,50%'; },
  douaMici: function () { return '140,140,r'; }
};
var FRONT_BUN = /^(\d+([.,]\d+)?%?|r)$/i;
var listaS = function (s) { s = String(s == null ? '' : s).trim(); return s ? s.split(',').map(function (x) { return x.trim(); }) : []; };
var fmtMm = function (v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); };

function randeazaSertare() {
  var box = $('sertareBox'), tb = $('sertareTabel');
  if (!box || !tb) return;
  var lista = listaS(params.sertareH);
  var nou = lista.length > 0 && +params.nSer > 0;
  box.classList.toggle('hidden', !nou);
  ['hFront', 'hCutie'].forEach(function (id) {
    var el = $(id); if (el) el.closest('label').classList.toggle('hidden', nou);
  });
  document.querySelectorAll('[data-impartire]').forEach(function (b) {
    var v = IMPARTIRI[b.dataset.impartire](+params.nSer || 3);
    b.classList.toggle('on', nou && params.sertareH === v);
  });
  if (!nou) return;
  var rez = (lastRes && lastRes.sertare) || [];
  var cl = listaS(params.sertareC);
  /* cât timp omul scrie în tabel, nu-l refacem: doar cifrele calculate */
  if (tb.contains(document.activeElement) && tb.children.length === lista.length) {
    rez.forEach(function (r, k) {
      var c = tb.querySelector('[data-calc="' + k + '"]'); if (c) c.textContent = fmtMm(r.front) + ' mm';
      var i = tb.querySelector('[data-sc="' + k + '"]'); if (i) i.placeholder = T('editor.auto') + ' ' + r.cutie;
    });
    return;
  }
  tb.innerHTML = lista.map(function (x, k) {
    var r = rez[k] || {};
    return '<tr><td class="c" style="color:var(--muted)">' + (k + 1) + '</td>' +
      '<td class="c"><input class="dim" data-sh="' + k + '" value="' + esc(x) + '" aria-label="' + esc(T('editor.colFront')) + ' ' + (k + 1) + '"></td>' +
      '<td class="c small" data-calc="' + k + '">' + (r.front != null ? fmtMm(r.front) + ' mm' : '') + '</td>' +
      '<td class="c"><input class="dim" type="number" min="20" max="1200" step="1" data-sc="' + k + '" value="' + esc(cl[k] || '') +
        '" placeholder="' + esc(T('editor.auto') + (r.cutie != null ? ' ' + r.cutie : '')) + '" aria-label="' + esc(T('editor.colCutie')) + ' ' + (k + 1) + '"></td></tr>';
  }).join('');
}

/* numărul de sertare schimbat: lista fronturilor se lungește cu „r" sau se taie */
function potrivesteSertare() {
  var lista = listaS(params.sertareH);
  if (!lista.length) return;
  var n = +params.nSer || 0;
  if (n <= 0) return;
  while (lista.length < n) lista.push('r');
  params.sertareH = lista.slice(0, n).join(',');
  var cl = listaS(params.sertareC);
  params.sertareC = cl.length ? cl.slice(0, n).join(',') : '';
}

function legaSertare() {
  var tb = $('sertareTabel');
  if (!tb) return;
  tb.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.sh != null) {
      var v = el.value.trim();
      var bun = FRONT_BUN.test(v);
      el.classList.toggle('invalid', !bun);
      if (!bun) return;
      var lista = listaS(params.sertareH);
      lista[+el.dataset.sh] = v.toLowerCase().replace(',', '.');
      params.sertareH = lista.join(',');
    } else if (el.dataset.sc != null) {
      var cl = listaS(params.sertareC);
      while (cl.length < +params.nSer) cl.push('');
      cl[+el.dataset.sc] = el.value.trim();
      params.sertareC = cl.some(function (x) { return x !== ''; }) ? cl.join(',') : '';
    } else return;
    render(); scheduleSave();
  });
  document.querySelectorAll('[data-impartire]').forEach(function (b) {
    b.addEventListener('click', function () {
      var tip = b.dataset.impartire;
      var n = tip === 'egale' ? (+params.nSer || 3) : 3;
      params.nSer = n;
      params.sertareH = IMPARTIRI[tip](n);
      params.sertareC = '';
      render(); scheduleSave();
    });
  });
}

/* ---------------- configurările rapide ----------------

   Câte o grupă pe familie de corpuri (corpul de jos, suspendat, coloană,
   living, baie, colț, atipic). Corpul își vede întâi familia lui — o ține
   în `params.familie` de când a fost făcut din catalog; la corpurile mai
   vechi o ghicim din formă — și se poate alege alta din listă. */
var familieAleasa = null;

function familieCorp() {
  if (params.familie) return params.familie;
  var tip = params.tip || 'drept';
  if (/^colt/.test(tip)) return 'colt';
  if (tip === 'atipic') return 'atipic';
  if (+params.H > 1500) return +params.D >= 500 ? 'bucatarie-inalt' : 'living';
  return +params.D >= 450 ? 'bucatarie-jos' : 'bucatarie-sus';
}

function grupaRapida() {
  var grupe = DATA.configRapide || [];
  var cat = familieAleasa || familieCorp();
  return grupe.filter(function (g) { return g.cat === cat; })[0] || grupe[0];
}

function randeazaRapide() {
  var box = $('configRapide'), sel = $('familieRapid');
  if (!box) return;
  var grupe = DATA.configRapide || [];
  var g = grupaRapida();
  if (!g) return;
  if (sel && !sel.options.length) {
    sel.innerHTML = grupe.map(function (x) { return '<option value="' + esc(x.cat) + '">' + esc(x.nume) + '</option>'; }).join('');
  }
  if (sel) sel.value = g.cat;
  if (box.dataset.cat !== g.cat) {
    box.dataset.cat = g.cat;
    box.innerHTML = g.configs.map(function (c, i) {
      return '<button type="button" class="pastila" data-rapid="' + i + '">' + esc(c.nume) + '</button>';
    }).join('');
  }
  box.querySelectorAll('[data-rapid]').forEach(function (b) {
    var c = g.configs[+b.dataset.rapid];
    var la = Object.keys(c.set).every(function (k) {
      return k === 'familie' || JSON.stringify(params[k] == null ? '' : params[k]) === JSON.stringify(c.set[k]);
    });
    b.classList.toggle('on', la);
  });
}

function legaRapide() {
  var box = $('configRapide'), sel = $('familieRapid');
  if (!box) return;
  if (sel) sel.addEventListener('change', function () { familieAleasa = sel.value; randeazaRapide(); });
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rapid]');
    if (!b) return;
    var c = grupaRapida().configs[+b.dataset.rapid];
    if (!c) return;
    Object.keys(c.set).forEach(function (k) {
      params[k] = Array.isArray(c.set[k]) ? JSON.parse(JSON.stringify(c.set[k])) : c.set[k];
    });
    familieAleasa = null;
    /* conturul are tabelul lui: se reface, altfel ar rămâne laturile vechi */
    if (c.set.contur && typeof randeazaContur === 'function') { render(); randeazaContur(); }
    render(); scheduleSave();
    toast(c.nume);
  });
}

/* ---------------- conturul corpului atipic ---------------- */

/* Rândurile se redesenează doar când se schimbă numărul de laturi: altfel
   câmpul în care scrii ar fi înlocuit la fiecare tastă și ai pierde cursorul. */
function randeazaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;
  var contur = params.contur || [];

  tbody.innerHTML = contur.map(function (s, i) {
    return '<tr>' +
      '<td class="c" style="color:var(--muted)">' + (i + 1) + '</td>' +
      '<td class="small" data-nume="' + i + '">—</td>' +
      '<td class="c"><input class="dim" type="number" min="10" max="4000" step="1" ' +
        'data-contur="' + i + '" data-camp="lung" value="' + s.lung + '"></td>' +
      '<td class="c"><input class="dim" type="number" min="1" max="359" step="0.5" ' +
        'data-contur="' + i + '" data-camp="unghi" value="' + s.unghi + '"></td>' +
      '<td class="c"><button type="button" class="mini danger" title="' + T('editor.stergeLatura') +
        '" data-sterge-latura="' + i + '">✕</button></td>' +
      '</tr>';
  }).join('');

  actualizeazaContur();
}

/* Cele trei cote de sub scara, citite inapoi din conturul de acum. Se pun in
   casete numai cand omul nu scrie in ele, ca sa nu-i sara cifra sub mana. */
function umpleSubScara() {
  if (!$('ssBaza')) return;
  var c = window.PalCalc.coteSubScara(params.contur);
  /* O formă pe care cele trei cote CHIAR n-o pot scrie — mansarda cu cinci
     laturi, sau una făcută de mână — își deschide singură tabelul. Una doar
     strâmbă nu: acolo cotele se citesc, iar butonul de lângă ele o repară
     dintr-o apăsare. */
  var manual = $('conturManual');
  if (manual && !c) manual.open = true;

  /* Contur strâmb, dar de recunoscut: se spune ce s-a citit și ce face
     butonul, ca omul să nu creadă că i s-au pierdut cotele. */
  var semn = $('subScaraStramb');
  if (semn) {
    var stramb = !!(c && c.stramb);
    semn.classList.toggle('hidden', !stramb);
    if (stramb) semn.textContent = T('editor.subScaraStramb');
  }
  [['ssBaza', c && c.baza], ['ssStanga', c && c.stanga], ['ssDreapta', c && c.dreapta]]
    .forEach(function (x) {
      var el = $(x[0]);
      if (!el || el === document.activeElement) return;
      el.value = x[1] == null ? '' : x[1];
    });
}

/* numele laturilor, starea conturului și desenul — fără a atinge câmpurile */
function actualizeazaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;
  umpleSubScara();

  var g = window.PalCalc.conturGeometrie(params.contur || []);
  g.laturi.forEach(function (l, i) {
    var cel = tbody.querySelector('[data-nume="' + i + '"]');
    if (cel) cel.textContent = window.PalCalc.numeDirectie(l.dir, T);
  });

  var stare = $('conturStare');
  var scapa = function (x) {
    return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  if (g.inchis) {
    stare.innerHTML = '<span style="color:var(--accent)">' + scapa(T('editor.conturInchis')) + '</span> ' +
      scapa(T('editor.conturRezumat', { W: g.W, H: g.H, laturi: g.nrLaturi, suma: g.sumaUnghiuri }));
  } else {
    stare.innerHTML = '<span style="color:var(--danger)">' + scapa(T('editor.conturDeschis')) + '</span> ' +
      scapa(T('editor.conturRamas', { mm: g.eroare, laturi: g.nrLaturi,
                                      ceruta: g.sumaCeruta, suma: g.sumaUnghiuri }));
  }

  $('conturPreview').innerHTML = desenContur(g);
}

function desenContur(g) {
  if (!g.puncte.length) return '';
  var W = Math.max(g.W, 10), H = Math.max(g.H, 10);
  var mare = Math.max(W, H);
  var fs = mare / 16;          /* cota scrisă cât să se citească, nu cât să încapă */
  var iesire = mare * 0.075;   /* cât de departe de latură stă cota */
  /* Marginea desenului se face DUPĂ cote, nu înaintea lor: altfel cota de jos
     iese din pânză și se vede tăiată pe din două. */
  var pad = iesire + fs * 1.6;
  var o = [];

  var svgP = g.puncte.map(function (p) { return [p[0], H - p[1]]; });

  o.push('<polygon points="' + svgP.map(function (p) {
    return p[0] + ',' + p[1];
  }).join(' ') + '" class="ct-forma"/>');

  /* Mijlocul formei. Cotele se împing în afară față de el, ca să nu cadă
     niciuna peste desen — oricum ar fi întoarsă latura. */
  var cx = 0, cy = 0;
  svgP.forEach(function (p) { cx += p[0]; cy += p[1]; });
  cx /= svgP.length; cy /= svgP.length;

  g.laturi.forEach(function (l, i) {
    var x1 = l.de_la[0], y1 = H - l.de_la[1], x2 = l.la[0], y2 = H - l.la[1];
    o.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="ct-latura"/>');

    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    /* Normala la latură, întoarsă dinspre mijlocul formei spre afară. */
    var nx = y2 - y1, ny = x1 - x2;
    var lung = Math.hypot(nx, ny) || 1;
    nx /= lung; ny /= lung;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }

    o.push('<text x="' + r1(mx + nx * iesire) + '" y="' + r1(my + ny * iesire) +
           '" class="ct-cota" text-anchor="middle" dominant-baseline="central" ' +
           'font-size="' + r1(fs) + '" stroke-width="' + r1(fs * 0.22) + '">' +
           (i + 1) + ': ' + l.lung + '</text>');
  });

  if (!g.inchis) {
    var p0 = g.puncte[0];
    var ultim = g.laturi[g.laturi.length - 1];
    if (ultim) {
      o.push('<line x1="' + ultim.la[0] + '" y1="' + (H - ultim.la[1]) + '" x2="' + p0[0] +
             '" y2="' + (H - p0[1]) + '" class="ct-lipsa"/>');
    }
  }

  return '<svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (W + 2 * pad) + ' ' + (H + 2 * pad) +
         '" class="ct-svg" preserveAspectRatio="xMidYMid meet">' + o.join('') + '</svg>';
}

function legaContur() {
  var tbody = $('conturTabel');
  if (!tbody) return;

  tbody.addEventListener('input', function (e) {
    var i = e.target.dataset.contur;
    if (i === undefined) return;
    params.contur[+i][e.target.dataset.camp] = +e.target.value;
    actualizeazaContur();
    render();
    scheduleSave();
  });

  tbody.addEventListener('click', function (e) {
    var i = e.target.dataset.stergeLatura;
    if (i === undefined) return;
    params.contur.splice(+i, 1);
    randeazaContur(); render(); scheduleSave();
  });

  $('conturAdauga').onclick = function () {
    var ultim = params.contur[params.contur.length - 1] || { lung: 400, unghi: 90 };
    params.contur.push({ lung: ultim.lung, unghi: 90 });
    randeazaContur(); render(); scheduleSave();
  };

  /* adaugă latura care lipsește ca să se închidă conturul */
  $('conturInchide').onclick = function () {
    var g = window.PalCalc.conturGeometrie(params.contur);
    if (g.inchis) { toast(T('editor.conturDejaInchis')); return; }
    if (g.eroare < 1) return;
    params.contur.push({ lung: Math.round(g.eroare), unghi: 90 });
    randeazaContur(); render(); scheduleSave();
    toast(T('editor.conturAdaugat', { mm: Math.round(g.eroare) }));
  };

  /* Formular trimis la server, nu `fetch`: raspunsul e o pagina noua —
     comanda, cu toate corpurile facute. */
  function trimiteSubScara(x, y, z, bucati, latimi) {
    var f = document.createElement('form');
    f.method = 'post';
    f.action = '/corps/' + CORP_ID + '/sub-scara';
    [['_csrf', DATA.csrf], ['baza', x], ['dreapta', y], ['stanga', z], ['bucati', bucati],
     ['latimi', (latimi || []).join(',')]]
      .forEach(function (c) {
        var i = document.createElement('input');
        i.type = 'hidden'; i.name = c[0]; i.value = c[1];
        f.appendChild(i);
      });
    document.body.appendChild(f);
    f.submit();
  }

  $('conturReset').onclick = function () {
    params.contur = window.PalCalc.conturImplicit(+params.W || 800, +params.H || 720);
    randeazaContur(); render(); scheduleSave();
  };

  /* Corpul de sub scara: trei cote, si iese conturul intreg.

     Cu mai multe bucati nu se mai poate face aici: se fac corpuri NOI, deci
     trebuie server. Corpul deschis devine bucata din stanga, restul se
     adauga in aceeasi comanda si se platesc ca oricare alt corp. */
  /* Lățimea fiecărui corp, de la stânga: A, B, C...

     Primele se scriu, ultima e blocată și arată ce rămâne din bază. Dacă
     s-ar scrie toate, s-ar putea ajunge la o sumă care nu dă peretele; așa
     starea greșită nu există. La schimbarea bazei sau a numărului de
     corpuri se pornește iar din bucăți egale. */
  var LITERE = 'ABCDEFGHIJ';
  function randeazaLatimi() {
    var cutie = $('ssLatimi'), campuri = $('ssLatimiCampuri');
    if (!cutie || !campuri) return;
    var n = +($('ssBucati') || { value: 1 }).value || 1;
    var x = +$('ssBaza').value;
    cutie.classList.toggle('hidden', !(n > 1 && x >= 10));
    if (!(n > 1 && x >= 10)) { campuri.innerHTML = ''; return; }
    var egale = window.PalCalc.subScaraInBucati(x, 1000, 1000, n);
    campuri.innerHTML = egale.map(function (b, i) {
      var ultima = i === n - 1;
      return '<label>' + LITERE.charAt(i) +
        '<input type="number" step="10" min="' + window.PalCalc.SUB_SCARA_LAT_MIN + '"' +
        ' data-latime="' + i + '" value="' + b.baza + '"' +
        (ultima ? ' readonly tabindex="-1" class="muted"' : '') + '></label>';
    }).join('');
    potrivesteRestul();
  }

  /* Ultima lățime iese din bază minus celelalte. Întoarce lățimile scrise
     (fără ultima), sau null dacă nu se pot folosi — și atunci spune de ce. */
  function potrivesteRestul() {
    var campuri = $('ssLatimiCampuri'), rele = $('ssLatimiRele');
    if (!campuri) return null;
    var inputs = campuri.querySelectorAll('input[data-latime]');
    if (!inputs.length) return null;
    var x = +$('ssBaza').value, min = window.PalCalc.SUB_SCARA_LAT_MIN;
    var latimi = [], suma = 0, bune = true;
    for (var i = 0; i < inputs.length - 1; i++) {
      var v = +inputs[i].value;
      latimi.push(v);
      suma += v;
      if (!(v >= min)) bune = false;
    }
    var rest = r1(x - suma);
    inputs[inputs.length - 1].value = rest;
    if (!(rest >= min)) bune = false;
    if (rele) {
      rele.classList.toggle('hidden', bune);
      rele.textContent = bune ? '' : T('editor.subScaraLatimiRele', { min: min, rest: fmt(rest) });
    }
    return bune ? latimi : null;
  }

  if ($('ssBucati')) $('ssBucati').addEventListener('change', randeazaLatimi);
  if ($('ssBaza')) $('ssBaza').addEventListener('input', randeazaLatimi);
  if ($('ssLatimiCampuri')) $('ssLatimiCampuri').addEventListener('input', potrivesteRestul);

  $('ssFa').onclick = function () {
    var x = +$('ssBaza').value, z = +$('ssStanga').value, y = +$('ssDreapta').value;
    if (!(x >= 10 && y >= 10 && z >= 10)) { toast(T('editor.subScaraCote')); return; }

    var bucati = +($('ssBucati') || { value: 1 }).value || 1;
    /* Aceeași regulă ca pe server: nici corpuri prea înguste, nici unele pe
       care editorul nu le-ar mai primi la salvare. */
    var deVerificat = bucati > 1 && $('ssLatimiCampuri') && potrivesteRestul()
      ? window.PalCalc.subScaraDinLatimi(x, y, z, potrivesteRestul())
      : window.PalCalc.subScaraInBucati(x, y, z, bucati);
    var problema = window.PalCalc.subScaraProblema(deVerificat);
    if (problema) { toast(T('editor.' + problema)); return; }
    if (bucati > 1) {
      if (!DATA.orderId) { toast(T('editor.subScaraFaraComanda')); return; }
      if (!$('ssLatimiCampuri').querySelector('input')) randeazaLatimi();
      var latimi = potrivesteRestul();
      if (!latimi) { toast($('ssLatimiRele').textContent); return; }
      window.PalIntreaba(T('editor.subScaraIntreabaPlata', {
        cate: bucati, noi: bucati - 1,
        cost: (bucati - 1) * (+DATA.pretCorp || 0),
        sold: DATA.sold
      }), function () { trimiteSubScara(x, y, z, bucati, latimi); });
      return;
    }
    params.contur = window.PalCalc.conturSubScara(x, y, z);
    randeazaContur(); render(); scheduleSave();
    var panta = params.contur[2];
    toast(T('editor.subScaraGata', {
      panta: fmt(panta.lung),
      a: fmt(r1(params.contur[1].unghi)),
      b: fmt(r1(panta.unghi))
    }));
  };
}

var fmt = function (v) { return Number.isInteger(v) ? String(v) : Number(v).toFixed(1); };
var r1 = function (v) { return Math.round(v * 10) / 10; };
function esc(s) { return String(s).replace(/[&<>"]/g, function (m) {
  return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

var serverPieces = null;  /* raspunsul curent de la server (sursa pentru coloanele platite) */
var lastRes = null;       /* rezultatul calc() local, pentru 3D si cote finite */

/* ---------------- salvare ---------------- */

var saveTimer = null, saving = false, dirty = false;

function setState(txt, cls) {
  var el = $('saveState');
  if (!el) return;
  el.textContent = txt;
  el.className = 'small ' + (cls || 'muted');
}

function scheduleSave() {
  dirty = true;
  setState(T('editor.seSalveaza'));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

function save() {
  if (saving) { scheduleSave(); return; }
  saving = true;
  dirty = false;

  fetch('/api/corps/' + CORP_ID, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': DATA.csrf },
    body: JSON.stringify({ name: params.nume, params: params })
  }).then(function (r) {
    if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || T('editor.eroareSalvare')); });
    return r.json();
  }).then(function (j) {
    params = Object.assign(params, j.params);
    setState(T('editor.salvat'));
    return loadPieces();
  }).catch(function (e) {
    setState(e.message || T('editor.eroareSalvare'), 'danger');
  }).finally(function () {
    saving = false;
    if (dirty) scheduleSave();
  });
}

/* piesele de la server: singura sursa pentru cant si cotele de taiere */
function loadPieces() {
  return fetch('/api/corps/' + CORP_ID + '/pieces', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      serverPieces = j;
      paid = !!j.paid;
      renderTable();
    })
    .catch(function () { /* lista ramane cu valorile libere */ });
}

/* ---------------- randare ---------------- */

function cantHTML(c) {
  var m = { g: 'g', s: 's', '-': '' };
  return '<span class="cant">' + c.map(function (v) {
    return '<span class="' + m[v] + '">' + (v === 'g' ? params.cg : v === 's' ? params.cs : '–') + '</span>';
  }).join('') + '</span>';
}

/* Piesa corespunzatoare de la server, doar daca lista e sincronizata.
   Potrivirea se face pe cheia piesei, nu pe numele ei: numele se schimba
   cu limba, cheia nu. */
function srv(i, piesa) {
  if (!serverPieces || !serverPieces.paid) return null;
  var list = serverPieces.pieces;
  if (!list || !lastRes || list.length !== lastRes.P.length) return null;
  var p = list[i];
  return (p && p.cheie === piesa.cheie) ? p : null;
}

function renderTable() {
  if (!lastRes) return;
  var rows = lastRes.P.map(function (p, i) {
    /* Numarul e acelasi cu cel de pe desen, cand corpul e explodat. Fara
       el, „a treia polita" din desen nu se leaga de niciun rand din lista. */
    var free = '<td class="c nr-piesa">' + (i + 1) + '</td>' +
               '<td>' + esc(p.nume) + (p.nota ? '<div class="tag">' + esc(p.nota) + '</div>' : '') + '</td>' +
               '<td class="num">' + p.buc + '</td>' +
               '<td class="num">' + fmt(p.L) + '</td>' +
               '<td class="num">' + fmt(p.l) + '</td>';
    var locked;
    if (!paid) {
      locked = '<td class="locked" title="' + esc(T('editor.dupaPlata')) + '">🔒</td>' +
               '<td class="locked">🔒</td><td class="locked">🔒</td>';
    } else {
      var s = srv(i, p);
      locked = s
        ? '<td>' + cantHTML(s.c) + '</td>' +
          '<td class="num"><b>' + fmt(s.TL) + '</b></td>' +
          '<td class="num"><b>' + fmt(s.Tl) + '</b></td>'
        : '<td class="muted">…</td><td class="num muted">…</td><td class="num muted">…</td>';
    }
    return '<tr data-pi="' + i + '">' + free + locked +
           '<td>' + esc(p.fibraText) + '</td></tr>';
  }).join('');

  $('rows').innerHTML = rows;
}

/* Câmpuri unde zero înseamnă „lasă calculul să hotărască". Un „0" scris în
   casetă nu spune asta nimănui, și acoperă și indiciul din spate. Corpurile
   făcute înainte au 0 salvat, deci nu ajunge să schimbăm doar valoarea
   implicită: îl arătăm gol oricând îl găsim. */
var ZERO_E_GOL = ['hUsi', 'hNisa', 'traverse', 'lg', 'manerL'];

function render() {
  fields.forEach(function (f) {
    if (!$(f)) return;
    var v = params[f];
    if ($(f).type === 'checkbox') { $(f).checked = !!+v; return; }
    $(f).value = (ZERO_E_GOL.indexOf(f) !== -1 && (v === 0 || v === '0')) ? '' : v;
  });
  aplicaTip();

  randeazaCompUsi();

  var res = window.PalCalc.calc(params, T);
  lastRes = res;

  var nume = params.nume || T('editor.corp');
  $('titlu').textContent = T('editor.listaPiese') + ' – ' + nume;
  $('titlu3d').textContent = T('editor.vedere3d') + ' – ' + nume;

  var warns = (serverPieces && serverPieces.warn) ? serverPieces.warn : res.warn;
  $('warns').innerHTML = warns.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('') +
    /* Ce nu se taie, dar se comandă: nu e o greșeală, deci stă pe verde. */
    (res.deComandat || []).map(function (d) {
      return '<div class="warn ok">' + esc(T('editor.deComandat.' + d.fel, { h: d.H, l: d.L, n: d.buc })) + '</div>';
    }).join('');

  renderTable();
  randeazaSertare();
  randeazaRapide();
  $('formule').innerHTML = formule(params, res);
  build3D(params, res);
}

function formule(c, r) {
  var t = +c.t, l = [];
  var nota = c.spate === 'aplicat'
    ? T('editor.formulaNotaAplicat', { tp: c.tp })
    : T('editor.formulaNotaNut', { off: window.PalCalc.NUT_OFF, tp: c.tp });

  l.push(T('editor.formulaInterior', {
    W: c.W, H: c.H, t: t, Wint: fmt(r.Wint), Hint: fmt(r.Hint), Dint: fmt(r.Dint), nota: nota
  }));

  if (+c.nUsi > 0) {
    var sertare = +c.nSer > 0 ? T('editor.formulaMinusSertare') : '';
    l.push(c.montaj === 'aplicat'
      ? T('editor.formulaUsaAplicata', { W: c.W, H: c.H, rm: c.rm, ri: c.ri,
                                         n: (+c.nUsi) - 1, nUsi: c.nUsi, sertare: sertare })
      : T('editor.formulaUsaIncastrata', { Wint: fmt(r.Wint), Hint: fmt(r.Hint), rinc: c.rinc,
                                           ri: c.ri, n: (+c.nUsi) - 1, nUsi: c.nUsi, sertare: sertare }));
    /* Cupa de balama se freaza in front. Fara fronturi nu se cumpara
       balamale si nu se freaza nimic — dar formula usii rămâne, fiindca ea
       da cotele pe care omul le duce la cine ii face fronturile. */
    if (!+c.faraFront) l.push(T('editor.formulaBalamale'));
  }
  if (+c.nPol > 0) l.push(T('editor.formulaPolita', { jp: c.jp, rp: c.rp }));
  if (+c.nSer > 0) l.push(T('editor.formulaSertar', { jg: c.jg, ts: c.ts }));
  l.push(T('editor.formulaTaiere', { cg: c.cg, cs: c.cs }));

  return l.map(function (x) { return '<div>' + x + '</div>'; }).join('');
}

/* ---------------- 3D ---------------- */

var V3 = null;
/* `m` e metalul manerului: singura piesa din desen care nu e PAL, deci
   singura care n-are voie sa aiba culoare de PAL. */
var COL = { f: 0xd9c7a8, g: 0xd48a1e, s: 0xf1cf93, '-': 0xb09572, p: 0x7a6650, m: 0x8d99a6 };
var ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
var FETE = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function init3D() {
  if (!window.THREE) {
    $('cvwrap').innerHTML = '<div class="nocv">' + esc(T('editor.fara3d')) + '</div>';
    return;
  }
  var cv = $('cv'), wrap = $('cvwrap');
  var renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 10, 50000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x66625a, 0.95));
  var dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(0.8, 1.6, 1.2); scene.add(dl);
  var dl2 = new THREE.DirectionalLight(0xffffff, 0.25); dl2.position.set(-1, 0.4, -0.8); scene.add(dl2);
  var group = new THREE.Group(); scene.add(group);
  var mats = {}; Object.keys(COL).forEach(function (k) { mats[k] = new THREE.MeshLambertMaterial({ color: COL[k] }); });
  /* Ușa de vitrină: sticlă, adică se vede prin ea ce e în corp. */
  mats.sticla = new THREE.MeshLambertMaterial({ color: 0x9cc7d6, transparent: true, opacity: 0.35 });
  var lineMat = new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.45 });

  V3 = { renderer: renderer, scene: scene, camera: camera, group: group, mats: mats, lineMat: lineMat,
        theta: 0.65, phi: 1.15, r: 2000, target: new THREE.Vector3(), meshes: [], sel: null,
        helper: null, ray: new THREE.Raycaster(), E: 0 };

  function resize() {
    var w = wrap.clientWidth || 600, h = Math.max(300, Math.min(480, Math.round(w * 0.62)));
    renderer.setSize(w, h, false); cv.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  else window.addEventListener('resize', resize);

  var ptrs = new Map(), moved = 0, lastD = 0;
  var dist = function () { var a = Array.from(ptrs.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  var clampR = function () { V3.r = Math.max(200, Math.min(30000, V3.r)); };

  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0; if (ptrs.size === 2) lastD = dist();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = ptrs.get(e.pointerId); if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      V3.theta -= dx * 0.008;
      V3.phi = Math.max(0.08, Math.min(Math.PI - 0.08, V3.phi - dy * 0.008));
    } else if (ptrs.size === 2) {
      var d = dist(); if (d > 0) { V3.r *= lastD / d; lastD = d; clampR(); }
    }
  });
  cv.addEventListener('pointerup', function (e) {
    if (ptrs.size === 1 && moved < 6) pick(e);
    ptrs.delete(e.pointerId);
  });
  cv.addEventListener('pointercancel', function (e) { ptrs.delete(e.pointerId); });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault(); V3.r *= Math.exp(e.deltaY * 0.0012); clampR();
  }, { passive: false });

  function pick(e) {
    var r = cv.getBoundingClientRect();
    var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
                              -((e.clientY - r.top) / r.height) * 2 + 1);
    V3.ray.setFromCamera(v, camera);
    var hits = V3.ray.intersectObjects(V3.meshes.filter(function (m) { return m.visible; }), false);
    select(hits.length ? hits[0].object : null);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() {
    requestAnimationFrame(loop);
    if ($('auto').checked && !reduce) V3.theta += 0.004;
    var t = V3.target;
    camera.position.set(t.x + V3.r * Math.sin(V3.phi) * Math.sin(V3.theta),
                        t.y + V3.r * Math.cos(V3.phi),
                        t.z + V3.r * Math.sin(V3.phi) * Math.cos(V3.theta));
    camera.lookAt(t);
    renderer.render(scene, camera);
    deseneazaEtichete();
  })();
}

function build3D(c, res) {
  if (!V3) return;
  var g = V3.group;
  while (g.children.length) {
    var m = g.children[0]; g.remove(m);
    if (m.geometry) m.geometry.dispose();
    m.children.forEach(function (ch) { ch.geometry && ch.geometry.dispose(); });
  }
  V3.meshes = []; select(null);

  res.P.forEach(function (p, pi) {
    p.boxes.forEach(function (b, bi) {
      var geo, mat, base;

      if (b.poly) {
        /* panou de colț: contur în plan, extrudat pe grosimea PAL-ului.
           Forma se desenează în XY și se culcă pe orizontală, deci z se inversează. */
        var shape = new THREE.Shape();
        b.poly.forEach(function (pt, i) {
          if (i) shape.lineTo(pt[0], -pt[1]); else shape.moveTo(pt[0], -pt[1]);
        });
        geo = new THREE.ExtrudeGeometry(shape, { depth: b.sy, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2);
        mat = V3.mats[b.f.py || 'f'];
        base = [b.x, b.y, b.z];
      } else if (b.polyFata) {
        /* panou vertical decupat după contur (corp atipic): forma e chiar în planul frontal */
        var shapeF = new THREE.Shape();
        b.polyFata.forEach(function (pt, i) {
          if (i) shapeF.lineTo(pt[0], pt[1]); else shapeF.moveTo(pt[0], pt[1]);
        });
        geo = new THREE.ExtrudeGeometry(shapeF, { depth: b.sz, bevelEnabled: false });
        mat = V3.mats[b.f.pz || 'f'];
        /* conturul e deja în coordonatele corpului: doar z se mută */
        base = [0, 0, b.z];
      } else {
        geo = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
        mat = ORDER.map(function (k) { return V3.mats[b.f[k] || '-']; });
        base = [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2];
      }

      var mesh = new THREE.Mesh(geo, mat);
      if (b.ry) mesh.rotation.y = b.ry;
      if (b.rz) mesh.rotation.z = b.rz;
      mesh.userData = { p: p, pi: pi, bi: bi, b: b, base: base };
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), V3.lineMat));
      g.add(mesh); V3.meshes.push(mesh);
    });
  });

  /* Manerele nu sunt piese de taiat, deci nu stau in `res.P` si n-au rand in
     lista. Intra aici, cu grupa lor, ca sa se poata stinge singure — cine se
     uita la imbinari nu vrea barele in fata. */
  (res.manere || []).forEach(function (b, bi) {
    var geoM = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
    var meshM = new THREE.Mesh(geoM, V3.mats.m);
    meshM.userData = { p: null, pi: -1, bi: bi, b: b,
                       base: [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2] };
    meshM.add(new THREE.LineSegments(new THREE.EdgesGeometry(geoM), V3.lineMat));
    g.add(meshM); V3.meshes.push(meshM);
  });

  /* Ușile de vitrină nu se taie, deci nici ele nu stau în `res.P`. Se văd
     de sticlă, cu grupa fronturilor, ca să se stingă odată cu ele. */
  (res.sticla3d || []).forEach(function (b, bi) {
    var geoS = new THREE.BoxGeometry(b.sx, b.sy, b.sz);
    var meshS = new THREE.Mesh(geoS, V3.mats.sticla);
    if (b.ry) meshS.rotation.y = b.ry;
    meshS.userData = { p: null, pi: -1, bi: bi, b: b,
                       base: [b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2] };
    meshS.add(new THREE.LineSegments(new THREE.EdgesGeometry(geoS), V3.lineMat));
    g.add(meshS); V3.meshes.push(meshS);
  });

  var prevMax = V3.maxDim || 0, maxDim = Math.max(res.W, res.H, res.D);
  V3.target.set(res.W / 2, res.H / 2, res.D / 2);
  if (Math.abs(prevMax - maxDim) > 1) { V3.r = maxDim * 2.9; V3.maxDim = maxDim; }
  applyExplode(); applyVis();
}

/* Numerele pieselor, scrise PESTE desen.

   Se arata doar cand corpul e explodat. Pe un corp inchis piesele stau una
   peste alta si etichetele s-ar ingramadi toate in acelasi loc — ar fi mai
   mult zgomot decat ajutor.

   Proiectam centrul fiecarei piese din spatiu in pixeli si punem acolo o
   bulina HTML. Text adevarat, nu desenat in textura: ramane citet la orice
   marime si se poate selecta. */
var _etichete = [];

function deseneazaEtichete() {
  var cutie = $('etichete3d');
  if (!cutie || !V3) return;

  var arata = V3.E > 1;
  if (!arata) {
    if (_etichete.length) { cutie.innerHTML = ''; _etichete = []; }
    return;
  }

  var vizibile = V3.meshes.filter(function (m) { return m.visible; });

  /* Refolosim bulinele in loc sa le facem la fiecare cadru: altfel ar
     insemna cateva zeci de elemente noi de saizeci de ori pe secunda. */
  while (_etichete.length < vizibile.length) {
    var e = document.createElement('span');
    e.className = 'eticheta3d';
    cutie.appendChild(e);
    _etichete.push(e);
  }
  while (_etichete.length > vizibile.length) cutie.removeChild(_etichete.pop());

  var lat = cutie.clientWidth, inalt = cutie.clientHeight;
  var v = new THREE.Vector3();

  vizibile.forEach(function (m, i) {
    var e = _etichete[i];
    m.getWorldPosition(v);
    v.project(V3.camera);

    /* z peste 1 inseamna in spatele camerei: acolo proiectia se intoarce
       pe dos si eticheta ar sari in partea gresita a ecranului. */
    if (v.z > 1) { e.style.display = 'none'; return; }

    e.style.display = '';
    e.style.left = ((v.x + 1) / 2 * lat) + 'px';
    e.style.top = ((1 - v.y) / 2 * inalt) + 'px';
    e.textContent = m.userData.pi + 1;
    e.classList.toggle('ales', V3.sel === m);
  });
}

function applyExplode() {
  if (!V3) return;
  var E = V3.E;
  V3.meshes.forEach(function (m) {
    var b = m.userData.b, o = m.userData.base;
    m.position.set(o[0] + b.ex[0] * E, o[1] + b.ex[1] * E, o[2] + b.ex[2] * E);
  });
  if (V3.helper) V3.helper.update();
}

function applyVis() {
  if (!V3) return;
  var on = {};
  document.querySelectorAll('.vis').forEach(function (cb) { on[cb.dataset.g] = cb.checked; });
  V3.meshes.forEach(function (m) { m.visible = !!on[m.userData.b.grp]; });
  if (V3.sel && !V3.sel.visible) select(null);
}

function select(mesh) {
  if (!V3) return;
  /* Manerul n-are rand in lista de debitare: nu e piesa de taiat. Se poate
     vedea, dar nu se poate alege. */
  if (mesh && !mesh.userData.p) mesh = null;
  if (V3.helper) { V3.scene.remove(V3.helper); V3.helper.geometry.dispose(); V3.helper = null; }
  V3.sel = mesh;
  document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.remove('sel'); });

  if (!mesh) {
    $('info').innerHTML = '<span class="muted">' + esc(T('editor.apasaPiesa')) + '</span>';
    return;
  }

  var helper = new THREE.BoxHelper(mesh, 0x0f6e6a);
  helper.material.linewidth = 2;
  V3.scene.add(helper); V3.helper = helper;

  var p = mesh.userData.p, b = mesh.userData.b, pi = mesh.userData.pi;
  var tr = document.querySelector('#rows tr[data-pi="' + pi + '"]');
  if (tr) tr.classList.add('sel');

  var formaLibera = !!(b.poly || b.polyFata);
  var th = b.poly ? b.sy : b.polyFata ? b.sz : Math.min(b.sx, b.sy, b.sz);
  /* la panourile decupate cantul nu se poate descrie pe cele 4 muchii: e în notă */
  var cants = formaLibera ? [] : ORDER.filter(function (k) { return b.f[k] !== 'f' && b.f[k] !== 'p'; })
    .map(function (k) {
      return T('fata.' + k) + ' ' + (b.f[k] === 'g' ? params.cg : b.f[k] === 's' ? params.cs : '–');
    });

  var s = srv(pi, p);
  var taiere = paid
    ? (s ? '<div>' + esc(T('editor.taiere')) + ' <span class="k"><b>' +
           fmt(s.TL) + ' × ' + fmt(s.Tl) + '</b></span> mm</div>'
         : '<div class="muted">' + esc(T('editor.taiereAstept')) + '</div>')
    : '<div class="muted">🔒 ' + esc(T('editor.taiereBlocata')) + '</div>';

  $('info').innerHTML =
    '<div><b>' + esc(p.nume) + '</b> <span class="tag">' +
      esc(T('editor.nBuc', { n: p.buc })) + '</span></div>' +
    '<div>' + esc(T('editor.finit')) + ' <span class="k">' +
      fmt(p.L) + ' × ' + fmt(p.l) + ' × ' + fmt(r1(th)) + '</span> mm</div>' +
    taiere +
    (paid && !formaLibera
      ? '<div>' + esc(T('editor.cantPeMuchii', {
          muchii: cants.length ? cants.join(', ') : T('editor.faraCant') })) + '</div>'
      : '') +
    (p.nota ? '<div class="tag">' + esc(p.nota) + '</div>' : '');
}

function setView(v) {
  if (!V3) return;
  var m = { iso: [0.65, 1.15], fata: [0, Math.PI / 2], sus: [0, 0.12], spate: [Math.PI, Math.PI / 2 - 0.15] }[v];
  V3.theta = m[0]; V3.phi = m[1];
}

/* ---------------- setări implicite pentru corpuri noi ----------------

   Stau în browserul omului, nu în bază: fiecare din atelier lucrează altfel
   și nimeni nu vrea ca setarea lui să sară pe corpurile colegului. De-asta
   nu pleacă nimic spre server; pe alt calculator se pun din nou.

   Se ating DOAR corpurile proaspete (`?nou=1` la redirect). Un corp vechi
   deschis a doua oară rămâne cum a fost lăsat, altfel ar sări cotele sub
   mâna omului. */

var CHEIE_SETARI = 'pal-calc.setari-corp';

/* `tip`, `W2`, `orb` și conturul lipsesc înadins: alea sunt forma corpului,
   nu felul de-a lucra al atelierului. La fel `nume`. */
var GRUPE = [
  /* Câmpurile fiecărei grupe stau în shared/models.js, lângă regula care
     le pune peste model — aceeași regulă o folosesc și cardurile din
     catalog. Aici stă doar ce ține de pagina asta. */
  { id: 'material',   camp: window.PalModels.campuriGrup('material'),   bifatLaInceput: true },
  { id: 'spate',      camp: window.PalModels.campuriGrup('spate'),      bifatLaInceput: true },
  { id: 'usi',        camp: window.PalModels.campuriGrup('usi'),        bifatLaInceput: true },
  { id: 'polite',     camp: window.PalModels.campuriGrup('polite'),     bifatLaInceput: true },
  { id: 'sertare',    camp: window.PalModels.campuriGrup('sertare'),    bifatLaInceput: true },
  { id: 'dimensiuni', camp: window.PalModels.campuriGrup('dimensiuni'), bifatLaInceput: false },
  { id: 'cantitati',  camp: window.PalModels.campuriGrup('cantitati'),  bifatLaInceput: false },
  /* Soclul sta singur, nu cu dimensiunile: latimea si inaltimea sunt ale
     corpului, soclul e felul de-a lucra al atelierului. Cine face fara
     picioare face fara picioare la toate corpurile de pe podea. */
  { id: 'soclu',      camp: window.PalModels.campuriGrup('soclu'),      bifatLaInceput: false },
  /* Traversele stau in grupa lor, nu cu soclul: se poate foarte bine un
     corp pe picioare cu traverse, sau unul pe soclu cu blat intreg. */
  { id: 'traverse',   camp: window.PalModels.campuriGrup('traverse'),   bifatLaInceput: false },
  /* Cine livreaza carcase livreaza carcase: e felul de-a lucra, nu ceva ce
     se hotaraste corp cu corp. Nebifat la inceput, insa — un corp fara
     fronturi aparut din senin e o paguba, nu o comoditate. */
  { id: 'faraFront',  camp: window.PalModels.campuriGrup('faraFront'),  bifatLaInceput: false,
    /* Un „1" langa numele grupei nu spune nimic nimanui. */
    arata: function (val) {
      return T(+val.faraFront ? 'editor.fronturiNuSeFac' : 'editor.fronturiSeFac');
    } }
];

function cheieGrup(id) { return 'setari.grup' + id.charAt(0).toUpperCase() + id.slice(1); }

/* localStorage poate lipsi cu totul (fereastră privată, stocare oprită din
   browser) și atunci aruncă la simpla citire. Fără setări e o pagubă mică;
   să cadă editorul din cauza asta ar fi una mare. */
function citesteSetari() {
  try {
    var brut = window.localStorage.getItem(CHEIE_SETARI);
    if (!brut) return null;
    var s = JSON.parse(brut);
    if (!s || typeof s !== 'object' || !s.val || !s.grupe) return null;
    return s;
  } catch (e) { return null; }
}

function scrieSetari(s) {
  try { window.localStorage.setItem(CHEIE_SETARI, JSON.stringify(s)); return true; }
  catch (e) { return false; }
}

function stergeSetari() {
  try { window.localStorage.removeItem(CHEIE_SETARI); } catch (e) { /* n-avem ce face */ }
}

function grupeBifate() {
  var g = {};
  document.querySelectorAll('#setariGrupe input[data-grup]').forEach(function (cb) {
    g[cb.dataset.grup] = cb.checked;
  });
  return g;
}

/* Pune setările peste ce-a trimis serverul. Materialul comenzii bate
   browserul: placa și cantul unui corp dintr-o comandă sunt ale comenzii,
   altfel piesele ar ieși din altă placă decât cea cumpărată. */
function aplicaSetari() {
  var s = citesteSetari();
  if (!DATA.nou || !s) return false;
  /* Regula stă în shared/models.js: aceeași o folosesc și cardurile din
     catalog, ca poza de pe card să fie corpul care iese. */
  return window.PalModels.aplicaSetari(params, s, {
    cheiModel: DATA.cheiModel || [], pePodea: DATA.pePodea, matFixat: DATA.matFixat
  });
}

function randeazaSetari() {
  var cutie = $('setariGrupe');
  if (!cutie) return;
  var s = citesteSetari();

  cutie.innerHTML = GRUPE.map(function (g) {
    var bifat = s ? !!s.grupe[g.id] : g.bifatLaInceput;
    var val = !s ? '' : (g.arata ? g.arata(s.val) : g.camp.map(function (f) {
      return (s.val[f] === undefined || s.val[f] === '') ? null : s.val[f];
    }).filter(function (v) { return v !== null; }).join(' · '));
    var blocat = g.id === 'material' && DATA.matFixat;
    return '<label class="check' + (blocat ? ' muted' : '') + '">' +
      '<input type="checkbox" data-grup="' + g.id + '"' + (bifat ? ' checked' : '') + '> ' +
      '<span>' + esc(T(cheieGrup(g.id))) +
      (val ? ' <span class="mono small muted">' + esc(val) + '</span>' : '') +
      (blocat ? ' <span class="small muted">— ' + esc(T('setari.matComanda')) + '</span>' : '') +
      '</span></label>';
  }).join('');

  var stare = $('setariStare');
  if (stare) stare.textContent = s ? T('setari.stareSalvat', { nume: s.nume || T('editor.corp') })
                                   : T('setari.nimic');
}

function salveazaSetari() {
  var val = {};
  GRUPE.forEach(function (g) { g.camp.forEach(function (f) { val[f] = params[f]; }); });
  if (!scrieSetari({ nume: params.nume || '', grupe: grupeBifate(), val: val })) {
    toast(T('setari.faraStocare'));
    return false;
  }
  randeazaSetari();
  return true;
}

function legaSetari() {
  var cutie = $('setariGrupe');
  if (!cutie) return;
  randeazaSetari();

  /* O bifă singură trebuie să și țină minte ceva, altfel omul bifează,
     pleacă, și la următorul corp nu se întâmplă nimic. */
  cutie.addEventListener('change', function (e) {
    if (!e.target.dataset.grup) return;
    salveazaSetari();
  });

  $('setariIa').onclick = function () {
    if (salveazaSetari()) toast(T('setari.tinutMinte'));
  };
  $('setariSterge').onclick = function () {
    stergeSetari();
    randeazaSetari();
    toast(T('setari.sters'));
  };
}

/* ---------------- evenimente ---------------- */

$('form').addEventListener('input', function (e) {
  var f = e.target.id;
  if (fields.indexOf(f) === -1) return;
  /* O bifă n-are `value` bun de citit: „on" nu înseamnă nimic pentru
     calcul. Se citește `checked` și se ține ca 0 sau 1, ca restul semnelor
     din parametri. */
  params[f] = e.target.type === 'checkbox'
    ? (e.target.checked ? 1 : 0)
    : e.target.type === 'number'
      ? (e.target.value === '' ? '' : +e.target.value)
      : e.target.value;
  if (f === 'nSer') potrivesteSertare();
  render();
  scheduleSave();
});

$('compUsiLista').addEventListener('change', function (e) {
  if (!e.target.dataset.comp) return;
  citesteCompUsi();
  render();
  scheduleSave();
});

document.querySelectorAll('[data-view]').forEach(function (b) {
  b.onclick = function () { setView(b.dataset.view); };
});
$('explode').addEventListener('input', function (e) {
  /* Depărtarea crește cu mărimea corpului: 260 mm desfac un corp de
     bucătărie, dar la un dressing de 2400 abia se văd — ușile ieșeau în
     față și acopereau tot. */
  if (V3) {
    var marime = lastRes ? Math.max(+lastRes.W || 0, +lastRes.H || 0, +lastRes.D || 0) : 0;
    V3.E = (+e.target.value) / 100 * Math.max(260, marime * 0.28);
    applyExplode();
  }
});
document.querySelectorAll('.vis').forEach(function (cb) { cb.addEventListener('change', applyVis); });
$('rows').addEventListener('click', function (e) {
  var tr = e.target.closest('tr[data-pi]');
  if (!tr || !V3) return;
  var pi = +tr.dataset.pi;
  var m = V3.meshes.find(function (x) { return x.userData.pi === pi && x.visible; });
  select(m || null);
});

var copyBtn = $('copyCorp');
if (copyBtn) {
  copyBtn.onclick = function () {
    fetch('/corps/' + CORP_ID + '/export.csv')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('indisponibil')); })
      .then(function (txt) {
        txt = txt.replace(/^﻿/, '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(txt).then(function () { toast(T('editor.copiat')); });
        }
        var ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); toast(T('editor.copiat')); }
        catch (e) { toast(T('editor.copiazaManual')); }
        document.body.removeChild(ta);
      })
      .catch(function () { toast(T('editor.nuSaCopiat')); });
  };
}

var tt;
function toast(m) {
  var t = $('toast');
  t.textContent = m; t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(function () { t.classList.remove('on'); }, 2200);
}

/* ---------------- pornire ---------------- */

/* Setările intră ÎNAINTE de primul render, ca omul să vadă direct corpul
   lui, nu pe cel implicit schimbându-se sub ochi. */
var setariPuse = aplicaSetari();

init3D();
legaContur();
legaPieseExtra();
legaSertare();
legaRapide();
legaSetari();
render();
loadPieces();

if (setariPuse) {
  setState(T('editor.seSalveaza'));
  scheduleSave();
  toast(T('setari.aplicat'));
} else {
  setState(T('editor.salvat'));
}

})();
