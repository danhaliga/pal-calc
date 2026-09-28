/* ============================================================
   Un Markdown mic, cât ne trebuie pentru articolele din site.

   Scris de mână, înadins. Ce se scrie aici ajunge într-o pagină publică, iar
   bibliotecile mari de Markdown lasă HTML brut să treacă — de-aia au opțiuni
   de „sanitize" pe care le uită toată lumea pornite. Aici e invers: textul se
   scapă ÎNTÂI, în întregime, și abia pe urmă i se pune înapoi HTML-ul pe care
   îl scriem noi. Nu există niciun drum prin care un `<script>` scris în
   articol să iasă ca `<script>` în pagină.

   Ce înțelege: titluri, paragrafe, liste, citate, linie despărțitoare,
   tabele simple, aldin, cursiv, cod, legături. Atât. Ce nu înțelege rămâne
   text, nu dispare.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalMarkdown = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  /* Legăturile sunt singurul loc unde intră o valoare de la autor într-un
     atribut. `javascript:`, `data:` și `vbscript:` sunt drumuri de execuție,
     nu adrese; le refuzăm și lăsăm textul gol de legătură. */
  function adresaBuna(url) {
    var u = String(url || '').trim();
    if (!u) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) {
      return /^(https?|mailto):/i.test(u) ? u : null;
    }
    /* fără schemă: drum din site sau ancoră */
    return /^[/#]/.test(u) ? u : null;
  }

  /* Bucăţile care se pot amesteca într-o linie. Se lucrează pe text DEJA
     scăpat, deci `<` din articol e aici `&lt;` și nu mai poate deschide
     nimic. Ordinea contează: codul întâi, ca să nu i se mănânce steluţele. */
  function inline(text) {
    var bucati = [];
    var pastreaza = function (html) {
      bucati.push(html);
      return '\u0000' + (bucati.length - 1) + '\u0000';
    };

    var s = text.replace(/`([^`]+)`/g, function (_, cod) {
      return pastreaza('<code>' + cod + '</code>');
    });

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (tot, eticheta, url) {
      var adr = adresaBuna(url);
      if (!adr) return eticheta;
      var afara = /^https?:/i.test(adr);
      return pastreaza('<a href="' + esc(adr) + '"' +
        (afara ? ' rel="noopener nofollow" target="_blank"' : '') + '>' + eticheta + '</a>');
    });

    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');

    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return bucati[+i]; });
  }

  function randTabel(linie) {
    return linie.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
  }

  function esteDespartitorDeTabel(linie) {
    return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(linie);
  }

  function randeaza(md) {
    var linii = esc(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    var paragraf = [];
    var scoateParagraful = function () {
      if (!paragraf.length) return;
      out.push('<p>' + inline(paragraf.join(' ')) + '</p>');
      paragraf = [];
    };

    while (i < linii.length) {
      var l = linii[i];

      if (!l.trim()) { scoateParagraful(); i++; continue; }

      var titlu = l.match(/^(#{1,6})\s+(.*)$/);
      if (titlu) {
        scoateParagraful();
        /* h1 e titlul articolului, pus de pagină. Ce scrie autorul începe
           de la h2, altfel ies două titluri de acelaşi rang pe pagină. */
        var rang = Math.min(6, titlu[1].length + 1);
        out.push('<h' + rang + '>' + inline(titlu[2].trim()) + '</h' + rang + '>');
        i++; continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) {
        scoateParagraful();
        out.push('<hr>');
        i++; continue;
      }

      /* tabel: un rând de antet urmat de linia de despărţire */
      if (l.indexOf('|') !== -1 && i + 1 < linii.length && esteDespartitorDeTabel(linii[i + 1])) {
        scoateParagraful();
        var antet = randTabel(l);
        i += 2;
        var randuri = [];
        while (i < linii.length && linii[i].indexOf('|') !== -1 && linii[i].trim()) {
          randuri.push(randTabel(linii[i]));
          i++;
        }
        out.push('<div class="tbl"><table><thead><tr>' +
          antet.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          randuri.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') +
          '</tbody></table></div>');
        continue;
      }

      var citat = l.match(/^&gt;\s?(.*)$/);   /* „>" e deja scăpat în acest punct */
      if (citat) {
        scoateParagraful();
        var randuriCitat = [citat[1]];
        i++;
        while (i < linii.length && /^&gt;\s?/.test(linii[i])) {
          randuriCitat.push(linii[i].replace(/^&gt;\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + inline(randuriCitat.join(' ')) + '</blockquote>');
        continue;
      }

      var lista = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
      if (lista) {
        scoateParagraful();
        var ordonata = /\d/.test(lista[1]);
        var elemente = [];
        while (i < linii.length) {
          var el = linii[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
          if (!el || /\d/.test(el[1]) !== ordonata) break;
          elemente.push('<li>' + inline(el[2].trim()) + '</li>');
          i++;
        }
        out.push(ordonata ? '<ol>' + elemente.join('') + '</ol>'
                          : '<ul>' + elemente.join('') + '</ul>');
        continue;
      }

      paragraf.push(l.trim());
      i++;
    }

    scoateParagraful();
    return out.join('\n');
  }

  /* Primele cuvinte, pentru lista de articole şi pentru descrierea paginii.
     Se ia din textul brut, fără semnele de Markdown. */
  function rezumat(md, cate) {
    var text = String(md == null ? '' : md)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*[#>]+\s*/gm, '')
      .replace(/^\s*([-*]|\d+\.)\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*`|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var n = cate || 180;
    if (text.length <= n) return text;
    var taiat = text.slice(0, n);
    var spatiu = taiat.lastIndexOf(' ');
    return (spatiu > n * 0.6 ? taiat.slice(0, spatiu) : taiat) + '…';
  }

  return { randeaza: randeaza, rezumat: rezumat, esc: esc, adresaBuna: adresaBuna };
});
