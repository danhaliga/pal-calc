'use strict';
/* Ajutoare mici, folosite în mai multe rute. */

/* Antetele HTTP acceptă doar latin1, deci numele de fișier se curăță de diacritice.
   Numele complet merge separat, în filename*, pe care browserele moderne îl preferă. */
function faraDiacritice(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function numeFisier(nume, fallback) {
  const curat = faraDiacritice(nume)
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return curat || fallback || 'export';
}

function dispozitieAtasament(nume, extensie) {
  const ext = extensie || 'csv';
  const ascii = numeFisier(nume) + '.' + ext;
  const complet = encodeURIComponent(String(nume) + '.' + ext);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${complet}`;
}

/* JSON pus într-un <script> din pagină: dacă textul conține </script>, browserul
   închide blocul acolo și restul devine HTML viu. Escapăm caracterele periculoase.
   Separatorii de linie U+2028/U+2029 sunt dați ca tipar construit din șir, ca să nu
   ajungă caractere invizibile în codul sursă. */
const SEPARATORI_LINIE = new RegExp('[\\u2028\\u2029]', 'g');

function jsonPentruPagina(valoare) {
  return JSON.stringify(valoare === undefined ? null : valoare)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(SEPARATORI_LINIE, function (c) {
      return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    });
}

/* Bucata de catalog de care are nevoie o pagină. Trimitem numai spațiile
   de nume cerute, nu tot dicționarul: o pagină nu are de ce să care textele
   celorlalte. Româna merge alături, ca text de rezervă. */
function catalogPagina(lang, spatii) {
  const PalI18n = require('../shared/i18n');
  const ia = (cod) => {
    const c = PalI18n.catalog(cod) || {};
    const out = {};
    for (const n of spatii) if (c[n] !== undefined) out[n] = c[n];
    return out;
  };
  const pachet = { catalog: ia(lang) };
  if (lang !== PalI18n.IMPLICITA) pachet.ro = ia(PalI18n.IMPLICITA);
  return pachet;
}

/* O eroare care se poate citi în orice limbă: poartă cheia, nu textul.
   Tratarea erorilor o traduce în limba paginii. */
function eroare(cheie, status) {
  const e = new Error(cheie);
  e.cheie = cheie;
  e.status = status || 400;
  return e;
}

module.exports = {
  catalogPagina,
  eroare, faraDiacritice, numeFisier, dispozitieAtasament, jsonPentruPagina };
