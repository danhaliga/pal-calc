'use strict';
/* Schimbarea parolei din pagina contului. Până aici nu exista deloc. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const PalI18n = require('../shared/i18n');
const citeste = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('ruta cere contul, parola de acum și o parolă nouă de cel puțin 8, scrisă de două ori', () => {
  const a = citeste('src', 'auth.js');
  assert.match(a, /router\.post\('\/cont\/parola', limiter, requireAuth,/);
  assert.match(a, /bcrypt\.compareSync\(parsed\.data\.parolaVeche, user\.password_hash\)/);
  assert.match(a, /parolaNoua: z\.string\(\)\.min\(8/);
  assert.match(a, /d\.parolaNoua === d\.parolaNoua2/);
});

test('pagina contului are formularul, iar mesajele vin numai din chei știute', () => {
  const v = citeste('views', 'cont.ejs');
  assert.match(v, /action="\/cont\/parola"/);
  ['parolaVeche', 'parolaNoua', 'parolaNoua2'].forEach(n => assert.match(v, new RegExp('name="' + n + '"')));
  assert.match(citeste('src', 'cont.js'), /ERORI_PAROLA\.indexOf\(req\.query\.parolaEroare\) !== -1/);
});

test('textele formularului există în toate limbile', () => {
  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json')).cont;
    ['parolaTitlu', 'parolaVeche', 'parolaNoua', 'parolaNoua2', 'parolaSchimba', 'parolaSchimbata', 'parolaVecheGresita']
      .forEach(k => assert.ok(c[k], l.cod + ': lipsește cont.' + k));
  });
});
