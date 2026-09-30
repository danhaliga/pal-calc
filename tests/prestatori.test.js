'use strict';
/* Prestatorii și trimiterea comenzii pe email. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'palcalc-prestatori-'));
process.env.DATA_DIR = DIR;
process.env.SESSION_SECRET = 'x'.repeat(48);
const { db, migrate } = require('../src/db');
migrate(() => {});
const P = require('../src/prestatori');
const email = require('../src/email');
const setari = require('../src/setari');
const I18n = require('../shared/i18n');
const t = I18n.creeaza('ro');
test.after(() => { db.close(); fs.rmSync(DIR, { recursive: true, force: true }); });

test('prestatorul: nume și email obligatorii, mai multe adrese cu virgulă', () => {
  assert.deepEqual(P.salveaza(0, { nume: '', email: 'a@b.ro' }), ['prestator.eroareNume']);
  assert.deepEqual(P.salveaza(0, { nume: 'X', email: 'nu-e-email' }), ['prestator.eroareEmail']);
  assert.deepEqual(P.salveaza(0, { nume: 'X', email: 'a@b.ro, altul' }), ['prestator.eroareEmail']);
  assert.deepEqual(P.salveaza(0, { nume: 'HTC Cubbis', oras: 'Iași', email: 'a@b.ro;  c@d.ro' }), []);
  const p = P.activi()[0];
  assert.equal(p.email, 'a@b.ro, c@d.ro');
  P.salveaza(p.id, { nume: 'HTC Cubbis', email: 'a@b.ro', activ: '0' });
  assert.equal(P.activi().length, 0, 'prestatorul ascuns nu apare atelierelor');
  assert.equal(P.toti().length, 1);
});

test('mesajul propus: câmpurile se înlocuiesc, cele necunoscute rămân', () => {
  assert.equal(P.completeaza('{comanda} / {atelier} / {nimic}', { comanda: 'Bucătărie', atelier: 'Mobila SRL' }),
               'Bucătărie / Mobila SRL / {nimic}');
  const pr = P.propunere({ name: 'Bucătărie' }, { firma: 'Mobila SRL', email: 'a@b.ro', telefon: '0722' }, null, t);
  assert.match(pr.subiect, /Bucătărie/);
  assert.match(pr.subiect, /Mobila SRL/);
  assert.match(pr.text, /0722/);
  setari.pune('EMAIL_SUBIECT', 'Comanda {comanda}', 1);
  assert.equal(P.propunere({ name: 'B' }, { email: 'a@b.ro' }, null, t).subiect, 'Comanda B');
  setari.sterge('EMAIL_SUBIECT');
});

test('emailul: oprit fără server, parola se păstrează criptată', () => {
  delete process.env.EMAIL_PROBA;
  assert.equal(email.pornit(), false);
  setari.pune('EMAIL_HOST', 'smtp.exemplu.ro', 1);
  setari.pune('EMAIL_DE', 'comenzi@exemplu.ro', 1);
  setari.pune('EMAIL_USER', 'u', 1);
  assert.equal(email.pornit(), false, 'cu utilizator dar fără parolă nu merge');
  setari.pune('EMAIL_PAROLA', 'secret', 1);
  assert.equal(email.pornit(), true);
  const brut = db.prepare("SELECT valoare FROM setari WHERE cheie = 'EMAIL_PAROLA'").get().valoare;
  assert.doesNotMatch(brut, /secret/);
  assert.equal(email.config().port, 587);
  assert.equal(email.config().secure, false);
});

test('un server care nu răspunde dă eroare, nu blochează', async () => {
  delete process.env.EMAIL_PROBA;
  setari.pune('EMAIL_HOST', '127.0.0.1', 1);
  setari.pune('EMAIL_PORT', '1', 1);
  await assert.rejects(email.trimite({ catre: 'a@b.ro', subiect: 's', text: 't' }));
});

test('în modul de probă emailul se scrie ca fișier, cu atașamentul', async () => {
  process.env.EMAIL_PROBA = '1';
  await email.trimite({ catre: 'a@b.ro', cc: 'c@d.ro', raspunsLa: 'c@d.ro', subiect: 'Comanda',
                        text: 'Text', atasamente: [{ nume: 'p.zip', continut: Buffer.from('abc') }] });
  const dir = path.join(DIR, 'emailuri-proba');
  const f = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8'));
  assert.equal(f.catre, 'a@b.ro');
  assert.equal(f.raspunsLa, 'c@d.ro');
  assert.deepEqual(f.atasamente, [{ nume: 'p.zip', octeti: 3 }]);
  delete process.env.EMAIL_PROBA;
});
