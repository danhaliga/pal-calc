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

module.exports = { faraDiacritice, numeFisier, dispozitieAtasament };
