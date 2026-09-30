'use strict';
/* Copia bazei de date: întreagă, cu tot ce e încă în jurnalul ei.
   ============================================================

   Baza e SQLite în modul WAL: ultimele scrieri stau o vreme în
   `app.db-wal`, nu în `app.db`. Un `cp app.db` le pierde — copia pare
   bună, dar îi lipsesc comenzile de azi. De-aia copia se face cu funcția de
   copiere a bazei (`db.backup`), care le prinde și merge și cu aplicația
   pornită.

   Unde: DATA_DIR/copii/app-AAAALLZZ-HHMM.db. Se păstrează ZILE zile.

   Pe server rulează zilnic (systemd: palcalc-copie.timer) și înainte de
   fiecare actualizare de versiune:
     sudo -u palcalc env DATA_DIR=/var/palcalc node scripts/copie-baza.js [eticheta]
   ============================================================ */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const ZILE = Number(process.env.COPII_ZILE || 30);
const DOSAR = path.join(DATA_DIR, 'copii');

async function main() {
  const sursa = path.join(DATA_DIR, 'app.db');
  if (!fs.existsSync(sursa)) throw new Error('nu găsesc baza: ' + sursa);
  fs.mkdirSync(DOSAR, { recursive: true });

  const acum = new Date();
  const doi = n => String(n).padStart(2, '0');
  const eticheta = String(process.argv[2] || '').replace(/[^A-Za-z0-9_-]/g, '');
  const nume = 'app-' + acum.getFullYear() + doi(acum.getMonth() + 1) + doi(acum.getDate()) + '-' +
               doi(acum.getHours()) + doi(acum.getMinutes()) + (eticheta ? '-' + eticheta : '') + '.db';
  const tinta = path.join(DOSAR, nume);

  const db = new Database(sursa, { readonly: true, fileMustExist: true });
  await db.backup(tinta);
  db.close();

  /* Copia se verifică: se deschide și se numără conturile. O copie care nu
     se deschide e mai rea decât niciuna — crezi că o ai. */
  /* Copia rămâne un singur fișier: fără jurnalul WAL alături. */
  const verif = new Database(tinta);
  verif.pragma('journal_mode = DELETE');
  const ok = verif.pragma('integrity_check', { simple: true });
  const conturi = verif.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  verif.close();
  if (ok !== 'ok') throw new Error('copia nu trece verificarea: ' + ok);

  /* Curățenia: copiile mai vechi de ZILE zile. */
  const prag = Date.now() - ZILE * 24 * 3600 * 1000;
  let sterse = 0;
  fs.readdirSync(DOSAR).forEach(f => {
    if (!/^app-\d{8}-\d{4}.*\.db(-wal|-shm)?$/.test(f)) return;
    const p = path.join(DOSAR, f);
    if (fs.statSync(p).mtimeMs < prag) { fs.unlinkSync(p); sterse++; }
  });

  console.log('copie făcută: ' + tinta + ' (' + Math.round(fs.statSync(tinta).size / 1024) + ' KB, ' +
              conturi + ' conturi, verificată)' + (sterse ? '; șterse ' + sterse + ' copii vechi' : ''));
}

main().catch(e => { console.error('COPIA NU S-A FĂCUT: ' + e.message); process.exit(1); });
