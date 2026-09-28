'use strict';
/* Șterge conturile lăsate în urmă de suitele de teste.

   Testele care trec prin HTTP își fac cont ca să aibă sesiune, și nu și-l
   strâng după ele. După câteva sute de rulări, lista de utilizatori din
   panoul de administrare devine necitibilă — care e omul adevărat printre
   patru sute de „verif7731-1790486448683"?

   Regula e domeniul, nu prefixul: `local.test` e rezervat prin RFC 6761
   tocmai pentru asta, deci nimeni adevărat n-are adresă acolo. Un tipar pe
   prefixe ar fi fragil — testele folosesc vreo șaizeci de prefixe diferite,
   și fiecare test nou mai inventează unul.

   Contul de seed (ADMIN_EMAIL) rămâne: e calea de intrare când se pierde
   contul propriu. Și niciun administrator nu se șterge, oricare ar fi
   adresa lui.

   Rulare:  node scripts/curata-teste.js          (arată ce ar șterge)
            node scripts/curata-teste.js --sterge (chiar șterge) */

const { db } = require('../src/db');

const DOMENIU = '@local.test';
const PASTREAZA = (process.env.ADMIN_EMAIL || 'admin@local.test').toLowerCase();
const chiar = process.argv.indexOf('--sterge') !== -1;

const candidati = db.prepare(`
  SELECT u.id, u.email,
         (SELECT COUNT(*) FROM corps  c WHERE c.user_id = u.id) corpuri,
         (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) comenzi
    FROM users u
   WHERE u.email LIKE ?
     AND u.email <> ?
     AND u.is_admin = 0
`).all('%' + DOMENIU, PASTREAZA);

if (!candidati.length) {
  console.log('nimic de curățat: niciun cont de test rămas în urmă');
  process.exit(0);
}

const corpuri = candidati.reduce((n, u) => n + u.corpuri, 0);
const comenzi = candidati.reduce((n, u) => n + u.comenzi, 0);

console.log(`conturi de test găsite: ${candidati.length}`);
console.log(`  cu ele pleacă: ${corpuri} corpuri, ${comenzi} comenzi`);
console.log(`  rămâne neatins: ${PASTREAZA}, plus orice administrator`);

if (!chiar) {
  console.log('');
  console.log('n-am șters nimic. Rulează cu --sterge dacă asta voiai.');
  process.exit(0);
}

/* Într-o singură tranzacție: ori pleacă toate, ori niciunul. Restul —
   corpuri, comenzi, plăți, sesiuni — pleacă prin ON DELETE CASCADE. */
const sterge = db.transaction(function (ids) {
  const st = db.prepare('DELETE FROM users WHERE id = ?');
  ids.forEach(function (id) { st.run(id); });
});
sterge(candidati.map(u => u.id));

const ramase = db.prepare('SELECT COUNT(*) n FROM users').get().n;
console.log(`șters. au rămas ${ramase} conturi.`);
