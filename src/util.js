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

module.exports = { faraDiacritice, numeFisier, dispozitieAtasament, jsonPentruPagina };
