'use strict';
/* Ajutor de depanare: rulează generarea CSV pe o comandă existentă.
   node scripts/debug-csv.js [idComanda] */

require('dotenv').config({ quiet: true });
const { db } = require('../src/db');
const orders = require('../src/orders');

const id = Number(process.argv[2] || 1);
const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
if (!o) { console.log('comanda nu există'); process.exit(1); }

console.log('comanda:', o.name);
const corpuri = orders.corpuriComenzii(id);
console.log('corpuri:', corpuri.map(c => c.name).join(' | '));

const raport = orders.raportComenzii(o);
console.log('piese:', raport.piese.length, '| materiale:', raport.materiale.map(m => m.nume).join(', '));

raport.piese.forEach(p => {
  [p.corpNume, p.cod, p.nume, p.buc, p.TL, p.Tl, p.material.tip + ' ' + p.material.gros,
   p.cant.muchii[0], p.cant.muchii[1], p.cant.muchii[2], p.cant.muchii[3],
   p.fibra, p.cnc ? 'DA' : '', p.nota]
    .map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';');
});
console.log('linii CSV: OK');

const safe = o.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-');
console.log('nume fișier:', 'debitare-' + safe + '.csv');
console.log('antet Content-Disposition:', `attachment; filename="debitare-${safe}.csv"`);
