'use strict';
/* Conexiunea SQLite si rularea migratiilor din db/migrations/*.sql */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
/* Unde stă baza de date.
   Pe calculatorul cuiva, lângă cod — e comod și nu strică nimic.
   Pe un server adevărat, dosarul aplicației se ÎNLOCUIEȘTE la fiecare
   urcare de versiune. Dacă baza stă acolo, pleacă odată cu el: comenzi,
   corpuri, conturi, tot. De-aia `DATA_DIR` o poate duce pe un disc care
   rămâne între urcări. Verificarea din src/pornire.js nu lasă aplicația să
   pornească în producție fără el. */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, 'data');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate(log = console.log) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  let n = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();
    log(`migrare aplicată: ${file}`);
    n++;
  }
  if (n === 0) log('baza de date este la zi');
  return n;
}

module.exports = { db, migrate, DATA_DIR };
