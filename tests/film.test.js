'use strict';
/* „Filmul" de pe pagina de prezentare: corpuri reale din catalog. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Film = require('../src/film');
const I18n = require('../shared/i18n');

test('filmul: corpurile vin din calcul, cu listă, planșă CNC și montaj', () => {
  const d = Film.date(I18n.creeaza('ro'));
  assert.equal(d.corpuri.length, Film.MODELE.length);
  d.corpuri.forEach(c => {
    assert.ok(c.cutii.length >= 8, c.nume + ': prea puține piese');
    c.cutii.forEach(b => {
      assert.ok(b.sx > 0 && b.sy > 0 && b.sz > 0, c.nume + ': cutie fără volum');
      assert.equal(b.ex.length, 3);
    });
    assert.equal(c.debitare.length, 5);
    assert.ok(c.cnc && c.cnc.L > 0 && c.cnc.l > 0);
    assert.ok(c.montaj.length >= 3 && c.montaj.every(m => !/^landing\./.test(m)), 'pașii de montaj sunt traduși');
  });
  const sertare = d.corpuri.find(c => c.cnc.sertare);
  assert.ok(sertare && sertare.cutii.some(b => b.mat === 'pfl' && b.y > 0), 'sertarele au fund de PFL în desen');
  assert.ok(d.corpuri.some(c => c.cutii.some(b => b.mat === 'sticla')), 'vitrina are uși de sticlă');
});

test('filmul vorbește limba paginii', () => {
  const en = Film.date(I18n.creeaza('en'));
  assert.notEqual(en.corpuri[0].nume, Film.date(I18n.creeaza('ro')).corpuri[0].nume);
});
