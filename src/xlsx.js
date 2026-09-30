'use strict';
/* Fișier Excel (.xlsx) fără nicio bibliotecă în plus.
   ============================================================

   Exporturile ieșeau în CSV. Excel îl deschide, dar îl ghicește: cu altă
   setare regională strică diacriticele, ia „;" drept text, iar „82,64"
   rămâne text, nu număr. Un .xlsx nu se ghicește — se deschide la fel
   peste tot, iar programele de facturare îl importă direct.

   Un .xlsx e o arhivă zip cu câteva fișiere XML. Pentru un tabel simplu
   (o foaie, primul rând cu capul de tabel îngroșat și înghețat) ajung
   câteva zeci de rânduri de cod: nu merită o bibliotecă de megabytes.

   Folosire:
     const buf = xlsx([{ nume: 'Debitare', randuri: [[cap...], [val...], ...] }]);
   Numerele rămân numere (se pot aduna în Excel); restul e text.
   ============================================================ */

const { zip } = require('./arhiva');

const esc = s => String(s)
  /* caracterele de control nu sunt voie în XML: Excel refuză fișierul */
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* A, B, … Z, AA, AB … */
function coloana(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

function celula(v, ref, stil) {
  const s = stil ? ' s="' + stil + '"' : '';
  if (typeof v === 'number' && Number.isFinite(v)) return '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>';
  if (v == null || v === '') return '';
  return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
}

function foaie(randuri) {
  /* lățimea coloanelor după cel mai lung text din ea, cu margini rezonabile */
  const lat = [];
  randuri.forEach(r => r.forEach((v, i) => {
    const n = String(v == null ? '' : v).length;
    lat[i] = Math.max(lat[i] || 6, Math.min(60, n + 2));
  }));
  const cols = lat.length
    ? '<cols>' + lat.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>'
    : '';
  const rows = randuri.map((r, ri) =>
    '<row r="' + (ri + 1) + '">' + r.map((v, ci) => celula(v, coloana(ci) + (ri + 1), ri === 0 ? 1 : 0)).join('') + '</row>'
  ).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    cols + '<sheetData>' + rows + '</sheetData>' +
    (randuri.length > 1 && lat.length ? '<autoFilter ref="A1:' + coloana(lat.length - 1) + randuri.length + '"/>' : '') +
    '</worksheet>';
}

/* Numele unei foi: max. 31 de caractere, fără []:*?/\ */
const numeFoaie = (s, i) => (String(s || '').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)) || ('Foaia ' + (i + 1));

function fisiere(foi) {
  const f = {};
  f['[Content_Types].xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    foi.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>';
  f['_rels/.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  f['xl/workbook.xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    foi.map((s, i) => '<sheet name="' + esc(numeFoaie(s.nume, i)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
    '</sheets></workbook>';
  f['xl/_rels/workbook.xml.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    foi.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="rId' + (foi.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  /* stilul 0: normal; stilul 1: îngroșat, pentru capul de tabel */
  f['xl/styles.xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '</styleSheet>';
  foi.forEach((s, i) => { f['xl/worksheets/sheet' + (i + 1) + '.xml'] = foaie(s.randuri); });
  return f;
}

function xlsx(foi) {
  return zip(fisiere(foi));
}

const TIP = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

module.exports = { xlsx, TIP, coloana };
