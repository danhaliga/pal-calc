'use strict';
/* Fișierul Excel și arhiva proiectului: se desfac înapoi exact ce s-a pus. */
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { zip } = require('../src/arhiva');
const { xlsx, coloana } = require('../src/xlsx');
const util = require('../src/util');

/* Citește un zip făcut de noi: nume → text. */
function desface(buf) {
  const out = {};
  for (let i = 0; buf.readUInt32LE(i) === 0x04034b50;) {
    const lung = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26);
    const nume = buf.slice(i + 30, i + 30 + n).toString('utf8');
    const date = zlib.inflateRawSync(buf.slice(i + 30 + n, i + 30 + n + lung));
    assert.equal(zlib.crc32(date), buf.readUInt32LE(i + 14), 'CRC greșit la ' + nume);
    out[nume] = date.toString('utf8');
    i += 30 + n + lung;
  }
  return out;
}

test('arhiva: numele cu diacritice și conținutul se păstrează', () => {
  const f = desface(zip({ 'Bucătărie/1 Listă.html': '<p>ăîșț</p>', 'Bucătărie/a.bin': Buffer.from([1, 2, 3]) }));
  assert.equal(f['Bucătărie/1 Listă.html'], '<p>ăîșț</p>');
  assert.ok('Bucătărie/a.bin' in f);
});

test('Excel: numerele rămân numere, textul e scăpat, capul e îngroșat', () => {
  const f = desface(xlsx([{ nume: 'Foaie: 1/2', randuri: [['Piesă', 'Buc'], ['a & <b>', 2.5], ['', null]] }]));
  const foaie = f['xl/worksheets/sheet1.xml'];
  assert.match(foaie, /<c r="B2"><v>2\.5<\/v><\/c>/);
  assert.match(foaie, /a &amp; &lt;b&gt;/);
  assert.match(foaie, /<c r="A1" s="1" t="inlineStr">/);
  assert.match(f['xl/workbook.xml'], /name="Foaie  1 2"/, 'caracterele interzise în numele foii');
  assert.ok(f['[Content_Types].xml'] && f['xl/styles.xml']);
});

test('coloanele Excel: A, Z, AA, AZ, BA', () => {
  assert.deepEqual([0, 25, 26, 51, 52].map(coloana), ['A', 'Z', 'AA', 'AZ', 'BA']);
});

test('numele dosarului din arhivă păstrează diacriticele, fără caractere interzise', () => {
  assert.equal(util.numeFisierLizibil('Bucătărie: Ion/Maria?'), 'Bucătărie Ion Maria');
  assert.equal(util.numeFisierLizibil('..'), 'proiect');
});
