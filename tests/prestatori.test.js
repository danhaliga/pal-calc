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
  assert.deepEqual(P.salveaza(0, { nume: 'Firma de probă', oras: 'Iași', email: 'a@b.ro;  c@d.ro' }), []);
  const p = P.toti().find(x => x.nume === 'Firma de probă');
  assert.equal(p.email, 'a@b.ro, c@d.ro');
  assert.ok(P.activi().some(x => x.id === p.id));
  P.salveaza(p.id, { nume: 'Firma de probă', email: 'a@b.ro', activ: '0' });
  assert.ok(!P.activi().some(x => x.id === p.id), 'prestatorul ascuns nu apare atelierelor');
  assert.ok(P.toti().some(x => x.id === p.id));
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

test('lista cercetată: 30 de firme publice, jumătate recomandate; fără adresă nu primesc comenzi', () => {
  const pub = P.publici().filter(p => p.verificat_la === '2026-09-30');
  assert.equal(pub.length, 30);
  assert.equal(pub.filter(p => p.verdict === 'recomandat').length, 15);
  assert.equal(pub[0].verdict, 'recomandat', 'recomandații stau primii');
  const faraEmail = pub.filter(p => !p.email);
  assert.ok(faraEmail.length >= 2);
  const activi = P.activi();
  faraEmail.forEach(p => assert.ok(!activi.some(a => a.id === p.id), p.nume + ' n-are adresă, nu poate primi'));
  assert.ok(pub.some(p => p.nume === 'HTC Cubbis' && p.email === 'office@cubbis.ro' && p.cnc === 1));
});

test('administratorul schimbă câmpurile paginii publice', () => {
  const p = P.publici().find(x => x.nume === 'Woodexpert');
  assert.deepEqual(P.salveaza(p.id, { nume: 'Woodexpert', email: p.email, regiune: 'transilvania', verdict: 'verificat',
    din_an: '2008', cnc: '1', excel: '1', public: '0', site: 'javascript:alert(1)' }), []);
  const d = P.unul(p.id);
  assert.equal(d.verdict, 'verificat');
  assert.equal(d.public, 0);
  assert.equal(d.egger, 0);
  assert.equal(d.site, '', 'doar adrese http(s)');
  /* fără adresă se poate doar dacă nu primește comenzi */
  assert.deepEqual(P.salveaza(p.id, { nume: 'Woodexpert', email: '', activ: '1' }), ['prestator.eroareEmail']);
  assert.deepEqual(P.salveaza(p.id, { nume: 'Woodexpert', email: '', activ: '0' }), []);
});

test('HTC Cubbis stă primul, pe pagină și în lista de trimitere', () => {
  assert.equal(P.publici()[0].nume, 'HTC Cubbis');
  assert.equal(P.activi()[0].nume, 'HTC Cubbis');
});

test('etichetele de servicii nu se rup la virgula dintr-un număr', () => {
  assert.deepEqual(P.etichete({ servicii: 'debitare, cant ABS 0,4–2 mm, CNC' }),
                   ['debitare', 'cant ABS 0,4–2 mm', 'CNC']);
  assert.deepEqual(P.etichete({ servicii: 'debitare,cant,CNC' }), ['debitare', 'cant', 'CNC']);
});
