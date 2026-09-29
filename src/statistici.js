'use strict';
/* ============================================================
   Ce se lucrează, pe țări.

   Constantele românești din aplicație nu sunt luate din cărți: regula
   cantului e scoasă din 96 de piese din patru lucrări adevărate, formatele
   de coală din fișierele Holzma ale atelierului. De-aia ies cotele bune.

   Pentru orice altă țară n-avem nicio măsurătoare — și n-o să avem din
   cărți: PAL-ul american vândut ca „¾ țoli" are de fapt 23/32 (18,26 mm),
   fiindcă se fabrică pe utilaje metrice și se vinde cu numele vechi. Cine
   scrie 19,05 din carte greșește fiecare corp cu 0,8 mm.

   Dar fiecare corp salvat POARTĂ constantele atelierului care l-a făcut:
   grosimea plăcii, a spatelui, jocurile de ușă, retragerea poliței, jocul
   de glisieră. Nu trebuie întrebat nimeni nimic. Se numără.

   DOUĂ PĂZITOARE, fără care cifrele de aici ar minți frumos:

   1. SE NUMĂRĂ ATELIERE, NU CORPURI. Un atelier care a făcut patruzeci de
      corpuri de 800 nu e o obișnuință de țară, e un om. Cifra care
      contează e câți oameni deosebiți folosesc o valoare.

   2. O CONSTANTĂ LĂSATĂ CUM A VENIT NU E O MĂSURĂTOARE. Dacă valoarea
      implicită e 18 și nimeni n-o schimbă, statistica spune „18" — dar a
      măsurat ce-am pus noi, nu ce lucrează omul. De-aia lângă fiecare
      constantă stă și câte ateliere au valori DIFERITE de cea implicită.
      Numai aia e vorbă adevărată.

   Cotele W, H, D nu suferă de necazul al doilea: pe alea le scrie omul de
   fiecare dată, nu le lasă cum vin.
   ============================================================ */

const { db } = require('./db');
const PalCalc = require('../shared/calc');
const PalTari = require('../shared/tari');

/* Constantele de atelier care merită numărate. Nu toate câmpurile unui corp:
   numai alea care spun cum lucrează omul, nu ce corp a vrut acum. */
const CONSTANTE = ['t', 'ts', 'tp', 'cg', 'cs', 'rm', 'ri', 'rinc', 'rp', 'jp', 'jg'];

const COTE = ['W', 'H', 'D'];

/* Câte ateliere și câte corpuri are fiecare țară. Un rând fără țară e un cont
   făcut înainte să existe întrebarea; se arată separat, nu se aruncă. */
function tari() {
  return db.prepare(`
    SELECT COALESCE(NULLIF(u.tara, ''), '') AS tara,
           COUNT(DISTINCT u.id) AS ateliere,
           COUNT(c.id)          AS corpuri
    FROM users u JOIN corps c ON c.user_id = u.id
    GROUP BY 1
    ORDER BY ateliere DESC, corpuri DESC, tara
  `).all();
}

/* Filtrul de țară, scris o dată. Șirul gol înseamnă „toate țările la un loc",
   iar asta e altceva decât „conturile fără țară" — de-aia null și nu ''. */
function unde(tara) {
  return tara == null
    ? { sql: '', par: [] }
    : { sql: " AND COALESCE(NULLIF(u.tara, ''), '') = ? ", par: [tara] };
}

/* Cele mai folosite valori ale unei cote (W, H sau D), într-o țară.
   Se întoarce și câte ateliere, și câte corpuri: primul număr spune dacă e o
   obișnuință de țară, al doilea doar cât de des o folosește cine o folosește. */
function coteFolosite(cheie, tara, cate) {
  if (COTE.indexOf(cheie) === -1) throw new Error('cotă necunoscută: ' + cheie);
  const f = unde(tara);
  return db.prepare(`
    SELECT json_extract(c.params, '$.${cheie}') AS valoare,
           COUNT(DISTINCT u.id) AS ateliere,
           COUNT(c.id)          AS corpuri
    FROM corps c JOIN users u ON u.id = c.user_id
    WHERE json_extract(c.params, '$.${cheie}') IS NOT NULL ${f.sql}
    GROUP BY valoare
    ORDER BY ateliere DESC, corpuri DESC, valoare
    LIMIT ?
  `).all(...f.par, Math.min(Math.max(Number(cate) || 8, 1), 50));
}

/* Constantele de atelier, cu păzitoarea a doua: lângă valoarea cea mai
   folosită stă și câte ateliere au ALTCEVA decât valoarea implicită. */
function constante(tara) {
  const implicite = PalCalc.defaults();
  const f = unde(tara);

  return CONSTANTE.map(function (cheie) {
    const randuri = db.prepare(`
      SELECT json_extract(c.params, '$.${cheie}') AS valoare,
             COUNT(DISTINCT u.id) AS ateliere,
             COUNT(c.id)          AS corpuri
      FROM corps c JOIN users u ON u.id = c.user_id
      WHERE json_extract(c.params, '$.${cheie}') IS NOT NULL ${f.sql}
      GROUP BY valoare
      ORDER BY ateliere DESC, corpuri DESC
    `).all(...f.par);

    const implicita = implicite[cheie];
    /* „Diferit de implicit" se măsoară față de valoarea implicită DE AZI.
       Un corp salvat pe vremea când implicitul era altul iese aici ca
       „schimbat" fără ca omul să fi atins ceva. E cel mai bun semn pe care-l
       avem, dar nu e o dovadă — de-aia coloana se cheamă „altfel", nu
       „schimbat de om". */
    const altfel = randuri.filter(r => Number(r.valoare) !== Number(implicita));

    return {
      cheie: cheie,
      implicita: implicita,
      valori: randuri,
      ceaMaiFolosita: randuri.length ? randuri[0] : null,
      atelierAltfel: altfel.reduce((s, r) => s + r.ateliere, 0),
      valoriAltfel: altfel.slice(0, 5)
    };
  });
}

/* ---------- pe ce grilă lucrează o țară ---------- */

/* Un milimetru rotund e multiplu de 10 (800, 720, 560). Un țol rotund e
   multiplu de un sfert de țol (6,35 mm) — 24", 34½", 12". Cele două grile
   aproape nu se ating: prima potrivire e abia la 1270 mm, adică 50 de țoli.
   Deci întrebarea „în ce lucrează oamenii din țara asta" se poate RĂSPUNDE
   din date, nu presupune. */
const SFERT_DE_TOL = 25.4 / 4;

/* Toleranțele sunt STRÂNSE, și asta s-a învățat pe pielea noastră.

   Cu 0,05 mm, două cote metrice obișnuite treceau drept cote în țoli: 400
   (un sfert de țol e la 0,05 mm de ea) și 870. Adică o lățime de corp pe
   care o taie toată Europa ar fi împins raportul către „lucrează în țoli".

   O cotă gândită în țoli cade EXACT pe grilă — 24 de țoli e 609,6 mm, fix.
   Deci n-avem nevoie de loc de joc: cât trebuie ca să treacă socoteala în
   virgulă mobilă, și nimic mai mult. */
const TOLERANTA_MM = 0.01;
const TOLERANTA_TOL = 0.02;

function peGrila(valoare, pas, toleranta) {
  const v = Number(valoare);
  if (!isFinite(v) || v <= 0) return false;
  const rest = Math.abs(v / pas - Math.round(v / pas)) * pas;
  return rest <= toleranta;
}

function grila(tara) {
  const f = unde(tara);
  const randuri = db.prepare(`
    SELECT json_extract(c.params, '$.W') AS W,
           json_extract(c.params, '$.H') AS H,
           json_extract(c.params, '$.D') AS D
    FROM corps c JOIN users u ON u.id = c.user_id
    WHERE 1 = 1 ${f.sql}
  `).all(...f.par);

  let total = 0, peMm = 0, peToli = 0;
  randuri.forEach(function (r) {
    [r.W, r.H, r.D].forEach(function (v) {
      if (v == null) return;
      total++;
      if (peGrila(v, 10, TOLERANTA_MM)) peMm++;
      if (peGrila(v, SFERT_DE_TOL, TOLERANTA_TOL)) peToli++;
    });
  });

  return {
    total: total,
    peMm: peMm, peToli: peToli,
    procentMm: total ? Math.round(peMm * 100 / total) : 0,
    procentToli: total ? Math.round(peToli * 100 / total) : 0,
    /* Verdictul se dă numai când e limpede și când sunt destule cote pe care
       să-l dai. Sub pragul ăsta nu se spune nimic — o țară cu trei corpuri
       nu are o obișnuință, are un om care a încercat aplicația. */
    destule: total >= 30,
    verdict: null
  };
}

/* Ce grilă iese din cifre. Null înseamnă „încă nu se poate spune", și ăsta e
   un răspuns bun: mai bun decât unul inventat. */
function verdictulGrilei(g) {
  if (!g.destule) return null;
  if (g.procentToli >= 60 && g.procentToli > g.procentMm + 20) return 'inch';
  if (g.procentMm >= 60 && g.procentMm > g.procentToli + 20) return 'mm';
  return null;
}

/* Tot ce trebuie unei pagini, într-o singură chemare. */
function raport(tara) {
  const g = grila(tara);
  g.verdict = verdictulGrilei(g);
  return {
    tara: tara,
    numeTara: tara ? PalTari.numeTara(tara) : null,
    cote: COTE.map(k => ({ cheie: k, valori: coteFolosite(k, tara, 8) })),
    constante: constante(tara),
    grila: g
  };
}

module.exports = {
  CONSTANTE, COTE, SFERT_DE_TOL, TOLERANTA_MM, TOLERANTA_TOL,
  tari, coteFolosite, constante, grila, verdictulGrilei, raport, peGrila
};
