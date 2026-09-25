/* ============================================================
   Catalogul de decoruri (Egger, Kronospan) — citit din catalog-data.js.

   Pentru fiecare decor: codul, numele, culoarea, grupul, grosimile de PAL
   disponibile și canturile care se fac în acel decor (lățime, grosime, stoc).
   Codul de disponibilitate: 's' = din stoc, 'p' = pe comandă.
   ============================================================ */
(function (root, factory) {
  var date = (typeof module === 'object' && module.exports)
    ? require('./catalog-data')
    : (typeof CATALOG !== 'undefined' ? CATALOG : (root.CATALOG || {}));
  var api = factory(date);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalCatalog = api;
})(typeof self !== 'undefined' ? self : this, function (CATALOG) {
  'use strict';

  var MARCI = Object.keys(CATALOG);

  function marca(brand) {
    var cheie = MARCI.filter(function (m) { return m.toLowerCase() === String(brand).toLowerCase(); })[0];
    return cheie ? CATALOG[cheie] : null;
  }

  function numeMarca(brand) {
    return MARCI.filter(function (m) { return m.toLowerCase() === String(brand).toLowerCase(); })[0] || brand;
  }

  function decoruri(brand) {
    var m = marca(brand);
    return m ? m.decors : [];
  }

  function decor(brand, cod) {
    return decoruri(brand).filter(function (d) { return d.cod === cod; })[0] || null;
  }

  /* grupurile de decoruri ale unei mărci, cu numărul lor */
  function grupuri(brand) {
    var out = [];
    decoruri(brand).forEach(function (d) {
      var g = out.filter(function (x) { return x.nume === d.grup; })[0];
      if (g) g.n++; else out.push({ nume: d.grup, n: 1 });
    });
    return out.sort(function (a, b) { return a.nume.localeCompare(b.nume, 'ro'); });
  }

  /* grosimile de PAL la care se face decorul */
  function grosimiPal(brand, cod) {
    var d = decor(brand, cod);
    if (!d) return [];
    return (d.gros || []).map(function (g) { return { mm: g[0], stoc: g[1] === 's' }; });
  }

  /* grosimile distincte de cant disponibile în decorul respectiv */
  function grosimiCant(brand, cod) {
    var d = decor(brand, cod);
    if (!d) return [];
    var vazute = {};
    (d.cant || []).forEach(function (c) {
      var mm = c[1];
      if (!vazute[mm] || (!vazute[mm].stoc && c[2] === 's')) {
        vazute[mm] = { mm: mm, stoc: c[2] === 's', latimi: [] };
      }
    });
    (d.cant || []).forEach(function (c) {
      if (vazute[c[1]] && vazute[c[1]].latimi.indexOf(c[0]) === -1) vazute[c[1]].latimi.push(c[0]);
    });
    return Object.keys(vazute)
      .map(function (mm) { return vazute[mm]; })
      .sort(function (a, b) { return a.mm - b.mm; })
      .map(function (x) { x.latimi.sort(function (a, b) { return a - b; }); return x; });
  }

  /* lățimea de cant potrivită pentru o grosime de PAL: prima ≥ grosimea plăcii */
  function latimeCant(brand, cod, grosimeCantMm, grosimePal) {
    var d = decor(brand, cod);
    if (!d) return null;
    var candidate = (d.cant || [])
      .filter(function (c) { return c[1] === grosimeCantMm && c[0] >= grosimePal; })
      .sort(function (a, b) { return a[0] - b[0]; });
    return candidate.length ? candidate[0][0] : null;
  }

  /* căutare după cod sau nume, pentru selectorul din pagină */
  function cauta(brand, text, limita) {
    var q = String(text || '').trim().toLowerCase();
    var lista = decoruri(brand);
    if (q) {
      lista = lista.filter(function (d) {
        return d.cod.toLowerCase().indexOf(q) !== -1 ||
               d.nume.toLowerCase().indexOf(q) !== -1 ||
               d.grup.toLowerCase().indexOf(q) !== -1;
      });
    }
    return limita ? lista.slice(0, limita) : lista;
  }

  /* datele necesare în pagină, fără greutatea catalogului întreg */
  function pentruBrowser() {
    var out = {};
    MARCI.forEach(function (m) {
      out[m] = {
        format: CATALOG[m].format,
        decors: CATALOG[m].decors.map(function (d) {
          return {
            cod: d.cod, nume: d.nume, hex: d.hex, grup: d.grup, nou: !!d.nou,
            gros: (d.gros || []).map(function (g) { return g[0]; }),
            cant: grosimiCant(m, d.cod).map(function (c) { return c.mm; })
          };
        })
      };
    });
    return out;
  }

  function valid(brand, cod) { return !!decor(brand, cod); }

  return {
    MARCI: MARCI,
    marca: marca,
    numeMarca: numeMarca,
    decoruri: decoruri,
    decor: decor,
    grupuri: grupuri,
    grosimiPal: grosimiPal,
    grosimiCant: grosimiCant,
    latimeCant: latimeCant,
    cauta: cauta,
    pentruBrowser: pentruBrowser,
    valid: valid
  };
});
