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

test('bucătăria de exemplu a planificatorului: corpuri reale, fără suprapuneri', () => {
  const Demo = require('../src/demo3d');
  const PalAnsamblu = require('../shared/ansamblu');
  const PalModels = require('../shared/models');
  const PalCalc = require('../shared/calc');
  const t = I18n.creeaza('ro');
  const d = Demo.date(t);
  assert.equal(d.corpuri.length, Demo.BUCATARIE.length);
  d.corpuri.forEach(c => {
    assert.ok(c.piese.length > 0 && c.W > 0 && c.H > 0);
    assert.ok(c.culori.corp && c.culori.front);
  });
  const corpuri = Demo.BUCATARIE.map((r, i) => ({ id: i + 1, poz: i + 1, nume: r[0],
    params: Object.assign(PalCalc.defaults(), PalModels.paramsFor(r[0], t)), pozitie: { perete: r[1], d: r[2], h: r[3] } }));
  assert.deepEqual(PalAnsamblu.ansamblu({ camera: Demo.CAMERA }, corpuri, t).probleme, []);
});

test('„Cum funcționează": fiecare pas are text și schimbă ceva la corp', () => {
  const Tut = require('../src/tutorial');
  const d = Tut.date(I18n.creeaza('ro'));
  assert.equal(d.scene.length, Tut.SCENE.length);
  d.scene.forEach(s => {
    assert.ok(!/^tutorial\./.test(s.titlu), s.id + ': titlul lipsește');
    s.pasi.forEach((p, i) => {
      assert.ok(p.text && !/^tutorial\./.test(p.text), s.id + ' pasul ' + (i + 1) + ': textul lipsește');
      assert.ok(p.piese.length > 0 && p.piese.every(x => x.f.length >= 5), s.id + ': piese fără fețe');
      if (i) {
        const a = JSON.stringify([s.pasi[i - 1].piese, s.pasi[i - 1].debitare, s.pasi[i - 1].explod]);
        const b = JSON.stringify([p.piese, p.debitare, p.explod]);
        assert.notEqual(a, b, s.id + ' pasul ' + (i + 1) + ': nu se schimbă nimic');
      }
    });
  });
});
