'use strict';
/* Citește catalogul de decoruri pus de utilizator în ../data/catalog.js și îl rezumă. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const cale = path.join(__dirname, '..', '..', 'data', 'catalog.js');
const sursa = fs.readFileSync(cale, 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(sursa + ';globalThis.__out = typeof CATALOG !== "undefined" ? CATALOG : null;', ctx);
const CATALOG = ctx.__out;

console.log('producători:', Object.keys(CATALOG).join(', '));

for (const [brand, d] of Object.entries(CATALOG)) {
  console.log(`\n--- ${brand} ---`);
  console.log('format:', d.format);
  console.log('sursa:', (d.sursa || '').slice(0, 90));
  console.log('decoruri:', d.decors.length);

  const grupuri = {};
  d.decors.forEach(x => { grupuri[x.grup] = (grupuri[x.grup] || 0) + 1; });
  console.log('grupuri:', Object.entries(grupuri).map(([g, n]) => `${g} (${n})`).join(', '));

  const grosimi = new Set();
  const canturi = new Set();
  d.decors.forEach(x => {
    (x.gros || []).forEach(g => grosimi.add(g[0]));
    (x.cant || []).forEach(c => canturi.add(c[1]));
  });
  console.log('grosimi PAL:', [...grosimi].sort((a, b) => a - b).join(', '));
  console.log('grosimi cant:', [...canturi].sort((a, b) => a - b).join(', '));

  const cuCant = d.decors.filter(x => (x.cant || []).length).length;
  console.log('decoruri cu cant disponibil:', cuCant);
  console.log('exemplu:', JSON.stringify(d.decors[0]).slice(0, 220));

  const coduriStoc = new Set();
  d.decors.forEach(x => {
    (x.gros || []).forEach(g => coduriStoc.add(g[1]));
    (x.cant || []).forEach(c => coduriStoc.add(c[2]));
  });
  console.log('coduri de disponibilitate folosite:', [...coduriStoc].join(', '));
}
