'use strict';
/* Jurnalul aplicației.
   ============================================================

   Ce s-a rupt, ce s-a întâmplat, și în ce ordine. Până acum erorile se
   duceau în `console.error`; pe un server adevărat ăla se derulează și se
   pierde, iar când te uiți tu rândul cu pricina a plecat de mult.

   Trei reguli care nu se încalcă:

   1. JURNALUL NU DĂRÂMĂ APLICAȚIA. Orice scriere e învelită: dacă baza de
      date e plină sau blocată, pierdem un rând de jurnal, nu comanda
      omului. Un jurnal care poate opri lucrul e mai rău decât niciunul.

   2. NU INTRĂ SECRETE. Parole, chei, jetoane, conținutul cookie-urilor —
      niciodată. Lista `INTERZISE` de mai jos taie câmpurile după nume,
      oricât de adânc ar fi îngropate în detalii.

   3. NU CREȘTE LA NESFÂRȘIT. Discul are 1 GB și pe el stă și baza de date
      adevărată. O buclă de erori ar putea umple discul și opri site-ul —
      adică exact paguba pe care jurnalul trebuia s-o prevină. De-aia sunt
      două limite, și de vârstă, și de număr.
   ============================================================ */

const { db } = require('./db');

const NIVELE = ['eroare', 'atentie', 'fapta'];

/* Câte zile ținem și câte rânduri, oricare vine prima. */
const ZILE = Number(process.env.JURNAL_ZILE || 90);
const MAXIM = Number(process.env.JURNAL_MAXIM || 50000);

/* Numele de câmp care nu au voie să ajungă în detalii, oricât de adânc.
   Se compară cu litere mici, pe bucată de nume: „stripeSecretKey" cade
   prin „secret". */
const INTERZISE = ['parola', 'password', 'passwd', 'secret', 'token', 'jeton',
                   'cookie', 'authorization', 'auth', 'csrf', 'apikey', 'api_key',
                   'hash', 'card', 'cvv', 'iban'];

function eInterzis(cheie) {
  const k = String(cheie).toLowerCase();
  return INTERZISE.some(function (rau) { return k.indexOf(rau) !== -1; });
}

/* Curăță un obiect de câmpurile interzise, oricât de adânc. Întoarce ceva
   ce se poate scrie ca JSON fără să fie nevoie de încredere în cel care a
   compus detaliile. */
function curata(valoare, adancime) {
  const d = adancime || 0;
  if (d > 6) return '…';                        /* obiecte legate în cerc */
  if (valoare === null || valoare === undefined) return valoare;
  if (Array.isArray(valoare)) {
    return valoare.slice(0, 50).map(function (v) { return curata(v, d + 1); });
  }
  if (valoare instanceof Error) {
    return { nume: valoare.name, mesaj: valoare.message, urma: scurt(valoare.stack, 2000) };
  }
  if (typeof valoare === 'object') {
    const out = {};
    Object.keys(valoare).slice(0, 40).forEach(function (k) {
      out[k] = eInterzis(k) ? '[ascuns]' : curata(valoare[k], d + 1);
    });
    return out;
  }
  if (typeof valoare === 'string') return scurt(valoare, 2000);
  return valoare;
}

function scurt(s, n) {
  const t = String(s == null ? '' : s);
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/* Adresa, trunchiată. IPv4 pierde ultimul număr, IPv6 păstrează primele
   patru grupuri. Ajunge ca să vezi că zece încercări vin din același loc,
   și nu ajunge ca să spui cine e omul. */
function adresaTrunchiata(ip) {
  const s = String(ip || '').replace(/^::ffff:/, '').trim();
  if (!s) return null;
  if (s.indexOf(':') !== -1) return s.split(':').slice(0, 4).join(':') + '::';
  const p = s.split('.');
  return p.length === 4 ? p[0] + '.' + p[1] + '.' + p[2] + '.0' : null;
}

/* Interogarea se pregateste la prima scriere, nu la incarcarea fisierului.
   Motivul e de ordine: `server.js` cere modulele INAINTE sa ruleze
   migratiile, deci la incarcare tabelul `jurnal` inca nu exista. Un modul
   de jurnal care cade daca e incarcat prea devreme e exact genul de lucru
   care darama aplicatia la prima pornire pe un server nou. */
let _insereaza = null;
function interogarea() {
  if (!_insereaza) {
    _insereaza = db.prepare(`
      INSERT INTO jurnal (nivel, sursa, mesaj, detalii, user_id, ruta, metoda, status, ip)
      VALUES (@nivel, @sursa, @mesaj, @detalii, @user_id, @ruta, @metoda, @status, @ip)
    `);
  }
  return _insereaza;
}

let deLaUltimaCuratenie = 0;

function scrie(nivel, sursa, mesaj, optiuni) {
  try {
    const o = optiuni || {};
    const req = o.req;

    interogarea().run({
      nivel: NIVELE.indexOf(nivel) !== -1 ? nivel : 'fapta',
      sursa: scurt(sursa || 'aplicatie', 40),
      mesaj: scurt(mesaj, 500),
      detalii: o.detalii === undefined ? null : JSON.stringify(curata(o.detalii)),
      user_id: o.userId != null ? o.userId : (req && req.user ? req.user.id : null),
      ruta: scurt(o.ruta || (req ? req.path : ''), 200) || null,
      metoda: req ? req.method : (o.metoda || null),
      status: o.status != null ? o.status : null,
      ip: adresaTrunchiata(o.ip || (req ? req.ip : ''))
    });

    /* Curățenia nu se face la fiecare scriere: ar însemna două interogări în
       plus pe fiecare eroare, tocmai când aplicația are deja necazuri. */
    if (++deLaUltimaCuratenie >= 200) { deLaUltimaCuratenie = 0; curatenie(); }
  } catch (e) {
    /* Regula 1: jurnalul nu dărâmă aplicația. Dacă nici măcar asta nu merge,
       rămâne consola — ea nu depinde de baza de date. */
    try { console.error('jurnalul nu a putut scrie:', e.message); } catch (e2) { /* nimic */ }
  }
}

const eroare = (sursa, mesaj, o) => scrie('eroare', sursa, mesaj, o);
const atentie = (sursa, mesaj, o) => scrie('atentie', sursa, mesaj, o);
const fapta = (sursa, mesaj, o) => scrie('fapta', sursa, mesaj, o);

/* Taie ce e prea vechi și ce e peste numărul maxim. Două limite, fiindcă
   una singură nu ajunge: 90 de zile de liniște încap lejer, dar 90 de zile
   de buclă de erori umplu discul. */
function curatenie() {
  try {
    db.prepare("DELETE FROM jurnal WHERE created_at < datetime('now', ?)").run('-' + ZILE + ' days');
    db.prepare(`
      DELETE FROM jurnal WHERE id NOT IN (
        SELECT id FROM jurnal ORDER BY id DESC LIMIT ?
      )
    `).run(MAXIM);
  } catch (e) {
    try { console.error('curățenia jurnalului a dat greș:', e.message); } catch (e2) { /* nimic */ }
  }
}

/* ---- citire, pentru panoul de administrare ---- */

function ultimele(optiuni) {
  const o = optiuni || {};
  const unde = [];
  const parametri = [];
  if (NIVELE.indexOf(o.nivel) !== -1) { unde.push('nivel = ?'); parametri.push(o.nivel); }
  if (o.sursa) { unde.push('sursa = ?'); parametri.push(o.sursa); }
  parametri.push(Math.min(Math.max(Number(o.limita) || 200, 1), 1000));

  return db.prepare(`
    SELECT * FROM jurnal
    ${unde.length ? 'WHERE ' + unde.join(' AND ') : ''}
    ORDER BY id DESC LIMIT ?
  `).all(...parametri);
}

function numaratoare() {
  const r = { total: 0, eroare: 0, atentie: 0, fapta: 0, ultimele24h: 0 };
  try {
    db.prepare('SELECT nivel, COUNT(*) n FROM jurnal GROUP BY nivel').all()
      .forEach(function (x) { r[x.nivel] = x.n; r.total += x.n; });
    r.ultimele24h = db.prepare(
      "SELECT COUNT(*) n FROM jurnal WHERE nivel = 'eroare' AND created_at > datetime('now','-1 day')"
    ).get().n;
  } catch (e) { /* tabelul poate lipsi înainte de migrare */ }
  return r;
}

function surse() {
  try {
    return db.prepare('SELECT DISTINCT sursa FROM jurnal ORDER BY sursa').all().map(x => x.sursa);
  } catch (e) { return []; }
}

module.exports = {
  scrie, eroare, atentie, fapta,
  ultimele, numaratoare, surse, curatenie,
  adresaTrunchiata, curata, eInterzis,
  NIVELE, ZILE, MAXIM
};
