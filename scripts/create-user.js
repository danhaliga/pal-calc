'use strict';
/* Creeaza un cont direct in baza de date, ocolind regulile formularului public
   (email valid, parola de minim 8 caractere). Pentru conturi de test sau admin.

   Utilizare:
     node scripts/create-user.js <utilizator|email> <parola> [--admin] [--name "Nume"]

   Exemplu:
     node scripts/create-user.js danh dan --name "Test"
*/

require('dotenv').config();
const { db, migrate } = require('../src/db');
const { createUser, findByEmail } = require('../src/auth');

const args = process.argv.slice(2);
const flags = { admin: args.includes('--admin'), name: null };

const nameIdx = args.indexOf('--name');
if (nameIdx !== -1) flags.name = args[nameIdx + 1] || null;

const positional = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  if (nameIdx !== -1 && i === nameIdx + 1) return false;
  return true;
});

const [login, password] = positional;

if (!login || !password) {
  console.error('Utilizare: node scripts/create-user.js <utilizator|email> <parola> [--admin] [--name "Nume"]');
  process.exit(1);
}

migrate(() => {});

const key = String(login).trim().toLowerCase();
const existing = findByEmail(key);

if (existing) {
  const bcrypt = require('bcryptjs');
  db.prepare('UPDATE users SET password_hash = ?, name = COALESCE(?, name), is_admin = ? WHERE id = ?')
    .run(bcrypt.hashSync(password, 12), flags.name, flags.admin ? 1 : 0, existing.id);
  console.log(`contul „${key}” exista deja - parola a fost actualizata`);
} else {
  createUser({ email: key, password, name: flags.name, isAdmin: flags.admin ? 1 : 0 });
  console.log(`cont creat: ${key}`);
}

console.log(`autentificare: ${key} / ${password}`);
if (String(password).length < 8) {
  console.log('atentie: parola are sub 8 caractere - acceptabil doar pentru testare locala.');
}
