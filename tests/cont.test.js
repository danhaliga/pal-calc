'use strict';
/* Datele contului, și unitatea de măsură care iese din ele.

   Miezul: ȚARA PROPUNE UNITATEA, OMUL O HOTĂRĂȘTE. Testele de-aici păzesc
   partea aia și trei lucruri care s-ar strica în tăcere — o cheie de
   traducere scrisă greșit (pagina ar arăta cheia, nu textul), o limbă rămasă
   fără cheile paginii, și parola plimbată prin `res.locals` dacă cineva
   pune un `SELECT *` în locul listei de coloane. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PalTari = require('../shared/tari');
const cont = require('../src/cont');
const auth = require('../src/auth');

const RADACINA = path.join(__dirname, '..');
const citeste = (...p) => fs.readFileSync(path.join(RADACINA, ...p), 'utf8');
const RO = JSON.parse(citeste('locales', 'ro.json'));

/* ---------------- țara propune unitatea ---------------- */

test('unitatea vine din țară, nu din limbă', () => {
  assert.equal(PalTari.unitatePentru('US'), 'inch');
  assert.equal(PalTari.unitatePentru('CA'), 'inch');
  assert.equal(PalTari.unitatePentru('RO'), 'mm');
  assert.equal(PalTari.unitatePentru('DE'), 'mm');
  /* Australia și India vorbesc engleză și lucrează în milimetri. Dacă
     unitatea s-ar lega vreodată de limbă, testul ăsta cade primul. */
  assert.equal(PalTari.unitatePentru('AU'), 'mm');
  assert.equal(PalTari.unitatePentru('IN'), 'mm');
});

test('Regatul Unit lucrează în milimetri, deși toată lumea se așteaptă la țoli', () => {
  /* La atelier britanicii lucrează în mm — carcasa e 910, nu 36 de țoli.
     Nu e o scăpare, e o hotărâre; dacă o schimbă cineva, s-o schimbe știind. */
  assert.equal(PalTari.unitatePentru('GB'), 'mm');
});

test('țară necunoscută sau lipsă → milimetri, ca restul lumii', () => {
  ['', null, undefined, 'ZZ', 'XYZ', '12', 'Statele Unite'].forEach(rau => {
    assert.equal(PalTari.unitatePentru(rau), 'mm', `„${rau}" a dat altceva`);
  });
});

test('alegerea omului bate propunerea țării', () => {
  assert.equal(PalTari.unitateaLui({ tara: 'US' }), 'inch');
  assert.equal(PalTari.unitateaLui({ tara: 'US', unitate: 'mm' }), 'mm');
  assert.equal(PalTari.unitateaLui({ tara: 'RO', unitate: 'inch' }), 'inch');
  /* Gol înseamnă „n-a ales", nu „a ales milimetri": de-aia se mută singur
     dacă țara se schimbă. */
  assert.equal(PalTari.unitateaLui({ tara: 'US', unitate: '' }), 'inch');
  /* O unitate care nu există cade pe cea din țară, nu pe o eroare. */
  assert.equal(PalTari.unitateaLui({ tara: 'US', unitate: 'coti' }), 'inch');
  assert.equal(PalTari.unitateaLui({}), 'mm');
  assert.equal(PalTari.unitateaLui(null), 'mm');
});

/* ---------------- ce spune browserul ---------------- */

test('țara se scoate din antetul Accept-Language', () => {
  assert.equal(PalTari.dinAntet('en-US,en;q=0.9'), 'US');
  assert.equal(PalTari.dinAntet('ro-RO,ro;q=0.9,en;q=0.8'), 'RO');
  assert.equal(PalTari.dinAntet('en-GB'), 'GB');
  /* trei etichete: limba, scrierea, regiunea — regiunea e a treia */
  assert.equal(PalTari.dinAntet('sr-Latn-RS'), 'RS');
  /* litere mici în antet, cod mare la ieșire */
  assert.equal(PalTari.dinAntet('pt-br'), 'BR');
});

test('un antet fără regiune nu inventează o țară', () => {
  ['en', 'ro', '', null, undefined, '*', 'en;q=0.5',
   'en-ZZ',            /* regiune care nu e pe lista noastră */
   'zh-Hans'           /* scriere, nu regiune */
  ].forEach(a => {
    assert.equal(PalTari.dinAntet(a), null, `„${a}" a dat o țară din nimic`);
  });
});

/* ---------------- lista de țări ---------------- */

test('codurile de țară sunt curate și fără dubluri', () => {
  const vazute = new Set();
  PalTari.CODURI.forEach(c => {
    assert.ok(/^[A-Z]{2}$/.test(c), `cod ciudat: ${c}`);
    assert.ok(!vazute.has(c), `cod pus de două ori: ${c}`);
    vazute.add(c);
  });
  assert.ok(PalTari.CODURI.length > 150, 'lista de țări e prea scurtă');
});

test('toate țările au nume în toate cele treizeci de limbi', () => {
  /* Numele nu se traduc de mână, le dă `Intl.DisplayNames`. Testul verifică
     exact lucrul care s-ar rupe: un mediu cu datele de limbă tăiate, unde
     ar rămâne codul ISO în loc de nume. */
  const PalI18n = require('../shared/i18n');
  PalI18n.LIMBI.forEach(l => {
    const lista = PalTari.lista(l.cod);
    assert.equal(lista.length, PalTari.CODURI.length, `${l.cod}: lipsesc țări`);
    const caCodul = lista.filter(x => x.nume === x.cod);
    assert.equal(caCodul.length, 0,
      `${l.cod}: ${caCodul.length} țări au rămas cu codul în loc de nume`);
  });
});

test('lista e în ordinea alfabetului limbii, nu a codului ISO', () => {
  /* „HU" înaintea lui „AT" e ordinea ISO; în română Ungaria vine după
     Austria, și numai așa o găsește cineva în selector. */
  const ro = PalTari.lista('ro').map(x => x.nume);
  const sortate = ro.slice().sort(new Intl.Collator('ro').compare);
  assert.deepEqual(ro, sortate);

  const at = PalTari.lista('ro').findIndex(x => x.cod === 'AT');
  const hu = PalTari.lista('ro').findIndex(x => x.cod === 'HU');
  assert.ok(at < hu, 'Austria ar trebui înaintea Ungariei în română');
});

/* ---------------- adresa site-ului ---------------- */

test('site-ul scris pe scurt se întregește cu https', () => {
  assert.equal(cont.siteBun('atelierulmeu.ro'), 'https://atelierulmeu.ro');
  assert.equal(cont.siteBun('  www.atelier.ro/mobila  '), 'https://www.atelier.ro/mobila');
  assert.equal(cont.siteBun('http://atelier.ro'), 'http://atelier.ro');
  assert.equal(cont.siteBun('https://atelier.ro'), 'https://atelier.ro');
  assert.equal(cont.siteBun(''), '');
  assert.equal(cont.siteBun('   '), '');
});

test('ce nu poate fi o adresă de web se refuză, nu se curăță în tăcere', () => {
  /* Adresa asta ajunge într-un link pe care-l apasă altcineva — un
     administrator care se uită cine s-a înscris, de pildă. `null` înseamnă
     „spune-i omului că a greșit", nu „salvează altceva". */
  ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>',
   'vbscript:msgbox', 'file:///etc/passwd', 'mailto:x@y.ro'].forEach(rau => {
    assert.equal(cont.siteBun(rau), null, `„${rau}" a trecut`);
  });
});

/* ---------------- capul foii de debitare ---------------- */

test('un cont necompletat nu pune un cap gol pe foaie', () => {
  assert.equal(cont.capDeFoaie({}), null);
  assert.equal(cont.capDeFoaie(null), null);
  assert.equal(cont.capDeFoaie({ email: 'x@y.ro', cui: 'RO1' }), null,
    'e-mailul și codul fiscal singure nu fac un cap de foaie');
});

test('capul foii ia firma, iar dacă nu e, numele omului', () => {
  assert.equal(cont.capDeFoaie({ firma: 'Atelier X', name: 'Ion' }).nume, 'Atelier X');
  assert.equal(cont.capDeFoaie({ name: 'Ion' }).nume, 'Ion');
  const c = cont.capDeFoaie({ firma: 'A', oras: 'Cluj', telefon: '0700', cui: 'RO1', adresa: 'Str. 1' });
  assert.deepEqual(c, { nume: 'A', cui: 'RO1', telefon: '0700', oras: 'Cluj', adresa: 'Str. 1' });
});

/* ---------------- parola nu iese din tabel ---------------- */

test('lista de coloane citite despre om nu poartă parola', () => {
  /* `users` ține și `password_hash`. Un `SELECT *` l-ar plimba prin
     `res.locals.user` pe fiecare pagină, iar de acolo într-un jurnal sau
     într-un JSON pus în pagină. De-aia coloanele se scriu pe bucăți. */
  const coloane = auth.COLOANE_UTILIZATOR.split(',').map(s => s.trim());
  assert.ok(coloane.includes('id') && coloane.includes('email'));
  ['password_hash', 'password', 'parola'].forEach(rea => {
    assert.ok(!coloane.includes(rea), `„${rea}" se citește degeaba`);
  });
  /* Un `SELECT *` pe users nu e interzis oriunde: `findByEmail` are nevoie de
     hash ca să compare parola la autentificare. E interzis pe drumul care
     duce în pagină — `loadUser`, care pune rândul în `res.locals.user`, și
     citirile din `cont.js`, care ajung tot acolo. */
  const loadUser = citeste('src', 'auth.js').match(/function loadUser[\s\S]*?\n}/)[0];
  assert.ok(!/SELECT\s+\*/i.test(loadUser),
    'loadUser citește tot rândul, deci și parola, și o pune în res.locals');
  assert.ok(loadUser.indexOf('COLOANE_UTILIZATOR') !== -1,
    'loadUser nu mai folosește lista de coloane');
  assert.ok(!/SELECT\s+\*\s+FROM\s+users/i.test(citeste('src', 'cont.js')),
    'a apărut un SELECT * pe users în cont.js');
});

test('fiecare coloană citită există în baza de date', () => {
  /* Altfel pagina cade cu „no such column" la prima cerere, pe serverul
     adevărat, nu aici. Migrarea e măsura. */
  const migratii = fs.readdirSync(path.join(RADACINA, 'db', 'migrations'))
    .map(f => citeste('db', 'migrations', f)).join('\n');
  const dinInit = migratii.match(/id\s+INTEGER PRIMARY KEY[\s\S]*?\);/);
  const adaugate = (migratii.match(/ALTER TABLE users ADD COLUMN (\w+)/g) || [])
    .map(s => s.replace(/.*COLUMN /, ''));
  const dinTabel = new Set(adaugate.concat(
    (dinInit ? dinInit[0] : '').split('\n')
      .map(l => (l.trim().match(/^(\w+)\s+(INTEGER|TEXT)/) || [])[1]).filter(Boolean)
  ));

  auth.COLOANE_UTILIZATOR.split(',').map(s => s.trim()).forEach(c => {
    assert.ok(dinTabel.has(c), `coloana „${c}" nu e adăugată de nicio migrare`);
  });
});

/* ---------------- cheile de traducere ---------------- */

/* Cheile scrise cu `t('...')` în vederi. O cheie greșită nu dă eroare:
   pagina arată cheia, și numai cine se uită o vede. */
function cheileVederii(fisier) {
  const sursa = citeste('views', fisier);
  return Array.from(new Set((sursa.match(/\bt\('([a-zA-Z0-9_.]+)'/g) || [])
    .map(s => s.replace(/^t\('/, '').replace(/'$/, ''))))
    /* Cheile care se termină în punct sunt jumătăți lipite în vedere cu o
       valoare — `t('unitate.' + u)`. Nu se pot căuta întregi; le prinde
       testul de mai jos, care le compune cu listele adevărate. */
    .filter(k => !k.endsWith('.'));
}

function are(catalog, cheie) {
  return cheie.split('.').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, catalog) !== undefined;
}

test('toate cheile din pagina contului există în română', () => {
  cheileVederii('cont.ejs').forEach(k => {
    assert.ok(are(RO, k), `cheia „${k}" nu e în locales/ro.json`);
  });
});

test('toate cheile din formularul de înregistrare există în română', () => {
  cheileVederii('register.ejs').forEach(k => {
    assert.ok(are(RO, k), `cheia „${k}" nu e în locales/ro.json`);
  });
});

test('cheile compuse din pagina contului există și ele', () => {
  /* „unitate." și „profil." se lipesc în vedere cu valoarea, deci nu apar
     întregi în sursă și n-ar fi prinse de testul de mai sus. */
  PalTari.UNITATI.forEach(u => assert.ok(are(RO, 'unitate.' + u), `lipsește unitate.${u}`));
  cont.PROFILE.forEach(p => assert.ok(are(RO, 'profil.' + p), `lipsește profil.${p}`));
});

test('paginile contului sunt traduse în toate cele treizeci de limbi', () => {
  const PalI18n = require('../shared/i18n');
  const cerute = Object.keys(RO.cont).map(k => 'cont.' + k)
    .concat(Object.keys(RO.unitate).map(k => 'unitate.' + k))
    .concat(Object.keys(RO.profil).map(k => 'profil.' + k))
    .concat(['nav.cont', 'auth.tara', 'auth.taraNota',
             'admin.dupaTara', 'admin.dupaProfil', 'admin.nimeniNuAZis']);

  const parametri = t => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');

  PalI18n.LIMBI.forEach(l => {
    const c = JSON.parse(citeste('locales', l.cod + '.json'));
    cerute.forEach(k => {
      const v = k.split('.').reduce((o, x) => (o || {})[x], c);
      assert.ok(v !== undefined && String(v).trim() !== '',
        `${l.cod}: lipsește „${k}"`);
      /* Un {unitate} scris greșit lasă o paranteză goală în pagină, și numai
         cineva care citește limba aia ar vedea-o. */
      const asteptat = k.split('.').reduce((o, x) => (o || {})[x], RO);
      assert.equal(parametri(v), parametri(asteptat),
        `${l.cod}: parametrii s-au schimbat la „${k}"`);
    });
  });
});

/* ---------------- ce nu se cere pe pagina contului ---------------- */

test('nu se cere nimic ce aplicația n-ar folosi', () => {
  /* Un câmp pe care nimic nu-l citește e un câmp completat degeaba. Lista de
     mai jos e scurtă inadins; dacă se adaugă un câmp, i se caută mai întâi
     locul unde se folosește. */
  const vedere = citeste('views', 'cont.ejs');
  ['moneda', 'currency', 'dataNasterii', 'numarAngajati', 'deUndeAiAflat', 'cifraDeAfaceri']
    .forEach(c => {
      assert.ok(vedere.indexOf('name="' + c + '"') === -1,
        `„${c}" se cere pe pagina contului, dar nimic nu-l citește`);
    });
});

test('fiecare dată cerută are un loc unde se folosește', () => {
  const vedere = citeste('views', 'cont.ejs');
  const cerute = Array.from(new Set((vedere.match(/name="([a-z_]+)"/g) || [])
    .map(s => s.slice(6, -1)))).filter(c => c !== '_csrf');

  const folosesc = ['src/cont.js', 'src/orders.js', 'src/admin.js', 'src/auth.js',
                    'views/layout-print.ejs', 'views/admin.ejs', 'views/register.ejs',
                    'public/cont.js'].map(f => citeste(...f.split('/'))).join('\n');

  cerute.forEach(c => {
    assert.ok(folosesc.indexOf(c) !== -1, `câmpul „${c}" nu se folosește nicăieri`);
  });
  /* Și invers, ca lista să nu fie golită pe furiș: */
  assert.ok(cerute.length >= 10, `pagina cere doar ${cerute.length} date`);
});
