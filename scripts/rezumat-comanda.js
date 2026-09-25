'use strict';
/* Rezumatul unei comenzi, în terminal: materiale, coli, cant, feronerie, CNC.
   node scripts/rezumat-comanda.js <idComanda> */

require('dotenv').config({ quiet: true });
const { db } = require('../src/db');
const orders = require('../src/orders');

const id = Number(process.argv[2]);
const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
if (!o) { console.error('comanda nu există'); process.exit(1); }

const r = orders.raportComenzii(o);

console.log(`COMANDA #${o.id}: ${o.name}`);
if (o.note) console.log(`  ${o.note}`);
console.log(`  ${r.totaluri.corpuri} corpuri · ${r.totaluri.randuri} rânduri de piese · ${r.totaluri.bucati} bucăți\n`);

console.log('CORPURI:');
r.corpuri.forEach(c => {
  console.log(`  ${String(c.poz).padStart(2)}. ${c.nume.padEnd(26)} ${c.dimensiuni.padEnd(22)} ${String(c.bucati).padStart(3)} piese`);
});

console.log('\nMATERIALE ȘI COLI:');
r.materiale.forEach(m => {
  console.log(`  ${m.nume.padEnd(44)} ${String(m.bucati).padStart(3)} piese`);
  console.log(`     ${m.bucatiColi.map(b => b.n + ' × ' + b.format.nume).join(' + ')}`);
  console.log(`     = ${m.coliIntregi} coli întregi (echivalent ${m.echivalent}) · deșeu ${m.deseuPct}%`);
});

console.log('\nCANT:');
r.cant.linii.forEach(c => {
  console.log(`  ${String(c.mm).padStart(4)} mm  ${String(c.decor).padEnd(22)} ${String(c.ml).padStart(7)} ml`);
});
console.log(`  total ${r.cant.total} ml (intern, cu adaos ${r.cant.adaosPct}%: ${r.cant.totalCuAdaos} ml)`);

console.log('\nFERONERIE:');
r.feronerie.forEach(f => console.log(`  ${f.nume.padEnd(36)} ${String(f.qty).padStart(5)} ${f.um}`));

console.log(`\nCNC: ${r.cnc.length} poziții`);
[...new Set(r.cnc.map(x => x.tip))].forEach(t => {
  console.log(`  ${t}: ${r.cnc.filter(x => x.tip === t).length}`);
});

const av = [];
r.corpuri.forEach(c => c.avertismente.forEach(a => av.push(`${c.nume}: ${a}`)));
console.log('\nAVERTISMENTE:');
if (!av.length) console.log('  niciunul');
else av.forEach(a => console.log(`  ! ${a}`));
