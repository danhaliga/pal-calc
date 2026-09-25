'use strict';
/* Creeaza contul de administrator si trei corpuri exemplu.
   Poate fi rulat de mai multe ori: nu duplica datele. */

require('dotenv').config();
const { db, migrate } = require('../src/db');
const { createUser, findByEmail } = require('../src/auth');
const PalCalc = require('../shared/calc');

migrate(() => {});

const email = (process.env.ADMIN_EMAIL || 'admin@local.test').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin1234';

let user = findByEmail(email);
if (user) {
  console.log(`contul ${email} există deja`);
} else {
  user = createUser({ email, password, name: 'Administrator', isAdmin: 1 });
  console.log(`cont administrator creat: ${email} / ${password}`);
}

/* aceleasi corpuri ca exemplele din calculatorul original */
const def = PalCalc.defaults();
const examples = [
  Object.assign({}, def),
  Object.assign({}, def, { nume: 'Corp suspendat', H: 720, D: 320, nUsi: 1, nPol: 2 }),
  Object.assign({}, def, { nume: 'Comodă cu sertar', W: 600, H: 720, D: 560, nUsi: 1, nPol: 1, nSer: 1 }),
  Object.assign({}, def, { nume: 'Dulap dormitor', W: 1000, H: 2100, D: 580, nUsi: 2, nPol: 4 })
];

const exists = db.prepare('SELECT 1 FROM corps WHERE user_id = ? AND name = ?');
const insert = db.prepare(
  'INSERT INTO corps (user_id, name, params, status) VALUES (?, ?, ?, ?)'
);

let added = 0;
for (const params of examples) {
  if (exists.get(user.id, params.nume)) continue;
  insert.run(user.id, params.nume, JSON.stringify(params), 'draft');
  added++;
}

console.log(added ? `${added} corpuri exemplu adăugate` : 'corpurile exemplu există deja');
console.log('gata. Pornește aplicația cu: npm run dev');
