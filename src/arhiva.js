'use strict';
/* Arhivă .zip, fără nicio bibliotecă în plus.
   ============================================================

   O folosesc fișierul Excel (care e tot un zip) și „Descarcă proiect",
   care strânge planșele și debitarea unei comenzi într-un singur fișier.

   zip({ 'dosar/nume.html': 'text sau Buffer', ... }) → Buffer
   Numele pot avea diacritice (se scriu în UTF-8, cu semnul pentru asta).
   ============================================================ */

const zlib = require('zlib');

function zip(f) {
  const locale = [], centrale = [];
  let pozitie = 0;
  Object.keys(f).forEach(nume => {
    const date = Buffer.isBuffer(f[nume]) ? f[nume] : Buffer.from(String(f[nume]), 'utf8');
    const comprimat = zlib.deflateRawSync(date);
    const crc = zlib.crc32(date);
    const n = Buffer.from(nume, 'utf8');

    /* 0x0800: numele e în UTF-8; 0x21: 1 ianuarie 1980, ora nu contează */
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6);
    loc.writeUInt16LE(8, 8); loc.writeUInt16LE(0, 10); loc.writeUInt16LE(0x21, 12);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comprimat.length, 18); loc.writeUInt32LE(date.length, 22);
    loc.writeUInt16LE(n.length, 26); loc.writeUInt16LE(0, 28);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comprimat.length, 20); cen.writeUInt32LE(date.length, 24);
    cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(pozitie, 42);

    locale.push(loc, n, comprimat);
    centrale.push(cen, n);
    pozitie += loc.length + n.length + comprimat.length;
  });
  const dir = Buffer.concat(centrale);
  const fin = Buffer.alloc(22);
  const nr = Object.keys(f).length;
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(nr, 8); fin.writeUInt16LE(nr, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(pozitie, 16);
  return Buffer.concat(locale.concat([dir, fin]));
}

module.exports = { zip };
