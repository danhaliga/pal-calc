'use strict';
/* Facturarea: datele clientului și exportul pentru programul de facturare. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palcalc-factura-'));
process.env.DATA_DIR = DIR;
process.env.SESSION_SECRET = 'x'.repeat(48);
const { db, migrate } = require('../src/db');
migrate(() => {});
const F = require('../src/facturare');
const setari = require('../src/setari');
const I18n = require('../shared/i18n');
const t = I18n.creeaza('ro');
test.after(() => { db.close(); fs.rmSync(DIR, { recursive: true, force: true }); });

const uid = db.prepare("INSERT INTO users (email, password_hash) VALUES ('c@x.ro', 'h')").run().lastInsertRowid;
const plata = (provider, cents, extra) => db.prepare(
  "INSERT INTO payments (user_id, kind, provider, provider_ref, amount_cents, currency, status, facturare) VALUES (?, 'topup', ?, ?, ?, 'ron', 'paid', ?)"
).run(uid, provider, provider + Math.random(), cents, extra ? JSON.stringify(extra) : null).lastInsertRowid;

test('ce trebuie pentru factură: persoană fizică sau firmă, cu datele lor', () => {
  assert.deepEqual(F.lipsuri(F.dinCont({})), ['tip']);
  assert.deepEqual(F.lipsuri({ tip: 'pf', nume: 'Ion', adresa: 'Str. 1', oras: 'Iași' }), []);
  assert.deepEqual(F.lipsuri({ tip: 'pj', firma: 'X SRL', cui: 'abc', adresa: 'a', oras: 'b' }), ['cui']);
  assert.ok(F.cuiBun('RO12345678') && F.cuiBun('12345678') && !F.cuiBun('RO'));
});

test('datele se salvează în cont și se copiază pe plată', () => {
  const lipsa = F.salveaza(uid, { tip_facturare: 'pj', firma: 'Mobila SRL', cui: 'ro 123456', adresa: 'Str. 5', oras: 'Cluj' });
  assert.deepEqual(lipsa, []);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  assert.equal(u.cui, 'RO123456');
  assert.equal(F.dinCont(u).firma, 'Mobila SRL');
});

test('exportul: numai plăți adevărate, cu TVA despărțit, fără dubluri', () => {
  setari.pune('FACTURARE_TVA', '1', 1);
  setari.pune('FACTURARE_COTA', '21', 1);
  const snap = F.dinCont(db.prepare('SELECT * FROM users WHERE id = ?').get(uid));
  plata('stripe', 10000, snap);
  plata('fake', 5000, snap);
  const noi = F.platiDeExportat({ doarNoi: true });
  assert.equal(noi.length, 1, 'plata de probă a intrat în export');
  const csv = F.csv(noi, t);
  assert.ok(csv.startsWith('﻿'), 'fără BOM, Excel strică diacriticele');
  assert.match(csv, /Mobila SRL;RO123456;/);
  assert.match(csv, /;82,64;21;17,36;100,00;RON/);
  /* în Excel sumele sunt numere, nu text cu virgulă */
  const r = F.tabel(noi, t)[1];
  assert.deepEqual(r.slice(16), [82.64, 21, 17.36, 100, 'RON']);
  F.marcheazaExportate(noi.map(p => p.id));
  assert.equal(F.platiDeExportat({ doarNoi: true }).length, 0, 'aceeași plată ar fi facturată de două ori');
  assert.equal(F.platiDeExportat({ doarNoi: false }).length, 1);
});

test('neplătitor de TVA: totul e valoare, TVA zero', () => {
  setari.pune('FACTURARE_TVA', '0', 1);
  assert.match(F.csv(F.platiDeExportat({}), t), /;100,00;0;0,00;100,00;RON/);
});

test('cu bani adevărați nu se alimentează fără date de facturare', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'src', 'credit.js'), 'utf8');
  assert.match(s, /stare\.driver === 'stripe' && facturare\.lipsuri\(/);
});
