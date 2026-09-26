/* Adaugă chei într-un catalog de traduceri, păstrând ordinea și ce era deja.
   Folosit din linia de comandă:  node scripts/merge-locale.js ro adaos.json */
'use strict';
const fs = require('fs');
const path = require('path');

const cod = process.argv[2];
const sursa = process.argv[3];
if (!cod || !sursa) {
  console.error('folosire: node scripts/merge-locale.js <cod-limba> <fisier.json>');
  process.exit(1);
}

const tinta = path.join(__dirname, '..', 'locales', cod + '.json');
const vechi = fs.existsSync(tinta) ? JSON.parse(fs.readFileSync(tinta, 'utf8')) : {};
const nou = JSON.parse(fs.readFileSync(sursa, 'utf8'));

function imbina(a, b) {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) &&
        a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      imbina(a[k], b[k]);
    } else {
      a[k] = b[k];
    }
  }
  return a;
}

fs.writeFileSync(tinta, JSON.stringify(imbina(vechi, nou), null, 2) + '\n', 'utf8');
console.log('actualizat', path.relative(process.cwd(), tinta));
