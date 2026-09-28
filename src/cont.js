'use strict';
/* ============================================================
   Contul.

   Până acum contul era un email și o parolă, plus limba. Ajunge ca să intri,
   nu ajunge ca să lucreze aplicația cum trebuie. Două lucruri lipseau:

     ȚARA, de la care vine UNITATEA DE MĂSURĂ. Toată aplicația e scrisă în
     milimetri. Un atelier american nu taie corpuri de 720 mm, ci de 34½
     țoli, și dacă îi arătăm milimetri se uită la unealtă ca la una străină.

     CINE E, pentru capul foii de debitare. Foaia aia pleacă la cel care taie
     palul; până acum nu scria pe ea nici al cui e corpul, nici pe ce număr
     se sună dacă o cotă nu se potrivește.

   Ce NU se cere aici, deși ar fi ușor: monedă (aplicația nu are prețuri de
   material, deci n-ar avea ce face cu ea), mărimea firmei, „de unde ai auzit
   de noi”. Un câmp pe care nimic nu-l citește e un câmp pe care omul îl
   completează degeaba.

   Nimic nu e obligatoriu. Contul merge gol mai departe.
   ============================================================ */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth, COLOANE_UTILIZATOR } = require('./auth');
const PalTari = require('../shared/tari');
const PalI18n = require('../shared/i18n');
const PalMd = require('../shared/markdown');
const jurnal = require('./jurnal');

const router = express.Router();

/* Ce face omul. De la asta pleacă mai târziu catalogul de modele care se
   arată primul — un atelier și un amator nu caută același corp. */
const PROFILE = ['atelier', 'tamplar', 'designer', 'magazin', 'amator'];

/* Lungimile sunt largi cu bună știință: un nume de firmă thailandez sau o
   adresă din Brazilia sunt mai lungi decât una din Cluj. */
const LUNGIMI = {
  name: 80, firma: 120, cui: 40, telefon: 40, oras: 80, adresa: 200, site: 200
};

const schema = z.object({
  name:    z.string().trim().max(LUNGIMI.name,    'cont.preaLung'),
  firma:   z.string().trim().max(LUNGIMI.firma,   'cont.preaLung'),
  cui:     z.string().trim().max(LUNGIMI.cui,     'cont.preaLung'),
  telefon: z.string().trim().max(LUNGIMI.telefon, 'cont.preaLung'),
  oras:    z.string().trim().max(LUNGIMI.oras,    'cont.preaLung'),
  adresa:  z.string().trim().max(LUNGIMI.adresa,  'cont.preaLung'),
  site:    z.string().trim().max(LUNGIMI.site,    'cont.preaLung'),

  /* Alegerile din liste nu se validează cu mesaj de eroare, ci se curăță: o
     valoare care nu e pe listă nu vine de la un om care completează un
     formular, ci de la unul care l-a măsluit, iar lui nu-i datorăm o
     explicație — îi datorăm doar să nu intre nimic strâmb în tabel. */
  tara:    z.string().trim().toUpperCase().catch(''),
  unitate: z.string().trim().toLowerCase().catch(''),
  profil:  z.string().trim().toLowerCase().catch(''),
  lang:    z.string().trim().catch('')
});

/* Adresa site-ului, așa cum o scrie omul. Nimeni nu tastează „https://” când
   e întrebat de site, deci o punem noi. Întoarce '' pentru gol, null pentru
   ceva ce nu poate fi o adresă de web — un „javascript:” pus aici ar ajunge
   într-un link pe care l-ar apăsa altcineva. */
function siteBun(brut) {
  const s = String(brut || '').trim();
  if (!s) return '';
  const cuSchema = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
  const bun = PalMd.adresaBuna(cuSchema);
  return bun && /^https?:/i.test(bun) ? bun : null;
}

/* Ce se pune în tabel: gol înseamnă NULL, nu șir vid, ca să nu avem în
   coloană două feluri de „nu mi-a spus”. Țara, unitatea și profilul rămân
   șir vid — așa le-a definit migrarea, NOT NULL DEFAULT ''. */
function oriNull(s) {
  const v = String(s == null ? '' : s).trim();
  return v === '' ? null : v;
}

function dateleFormularului(corp) {
  return {
    name:    String(corp.name    || ''),
    firma:   String(corp.firma   || ''),
    cui:     String(corp.cui     || ''),
    telefon: String(corp.telefon || ''),
    oras:    String(corp.oras    || ''),
    adresa:  String(corp.adresa  || ''),
    site:    String(corp.site    || ''),
    tara:    String(corp.tara    || ''),
    unitate: String(corp.unitate || ''),
    profil:  String(corp.profil  || ''),
    lang:    String(corp.lang    || '')
  };
}

/* Ce vede pagina. Se calculează într-un loc, ca formularul gol de la prima
   deschidere și cel întors cu o greșeală să arate la fel. */
function vedere(req, valori, eroare) {
  return {
    title: req.t('cont.titlu'),
    eroare: eroare || null,
    salvat: !eroare && req.query.salvat === '1',
    valori: valori,
    tari: PalTari.lista(req.lang),
    profile: PROFILE,
    limbi: PalI18n.LIMBI,
    lungimi: LUNGIMI,
    /* Ajutoarele pleacă în vedere ca funcții, nu ca text gata făcut: pagina
       are nevoie de numele țării propuse și de unitatea ei, iar amândouă
       depind de limba cererii. */
    numeTara: (cod) => PalTari.numeTara(cod, req.lang),
    unitatePentru: PalTari.unitatePentru,
    /* Pentru scriptul din pagină: doar țările care lucrează în țoli. Patru
       rânduri, nu două sute — restul lumii e în milimetri, iar o listă cu
       toate țările în pagină ar fi date cărate degeaba. */
    tariInToli: PalTari.IN_TOLI,
    /* Unitatea care ar ieși dacă omul lasă alegerea „după țară”. Se arată
       lângă selector, altfel „după țară” nu spune nimic. */
    unitateDinTara: PalTari.unitatePentru(valori.tara),
    unitateAcum: PalTari.unitateaLui(valori),
    /* Țara propusă din antetul browserului, pentru un cont care n-a spus
       încă nimic. O propunere, nu o hotărâre. */
    taraPropusa: valori.tara ? null : PalTari.dinAntet(req.headers['accept-language'])
  };
}

router.get('/cont', requireAuth, (req, res) => {
  res.render('cont', vedere(req, dateleFormularului(req.user)));
});

router.post('/cont', requireAuth, (req, res, next) => {
  const brut = dateleFormularului(req.body || {});
  const parsed = schema.safeParse(brut);

  if (!parsed.success) {
    return res.status(400).render('cont',
      vedere(req, brut, req.t(parsed.error.issues[0].message)));
  }

  const site = siteBun(parsed.data.site);
  if (site === null) {
    return res.status(400).render('cont', vedere(req, brut, req.t('cont.siteGresit')));
  }

  const tara = PalTari.normalizeaza(parsed.data.tara) || '';
  const unitate = PalTari.UNITATI.indexOf(parsed.data.unitate) !== -1 ? parsed.data.unitate : '';
  const profil = PROFILE.indexOf(parsed.data.profil) !== -1 ? parsed.data.profil : '';
  const lang = PalI18n.normalizeaza(parsed.data.lang) || '';

  try {
    db.prepare(
      'UPDATE users SET ' +
      '  name = ?, firma = ?, cui = ?, telefon = ?, oras = ?, adresa = ?, site = ?, ' +
      '  tara = ?, unitate = ?, profil = ?, lang = ? ' +
      'WHERE id = ?'
    ).run(
      oriNull(parsed.data.name), oriNull(parsed.data.firma), oriNull(parsed.data.cui),
      oriNull(parsed.data.telefon), oriNull(parsed.data.oras), oriNull(parsed.data.adresa),
      oriNull(site), tara, unitate, profil, lang, req.user.id
    );
  } catch (e) { return next(e); }

  /* Limba se ține și în sesiune, ca la selectorul din colț: altfel pagina
     următoare ar veni în limba veche pentru cine s-a schimbat chiar acum. */
  if (req.session && lang) req.session.lang = lang;

  /* În jurnal intră CE s-a schimbat, nu ce a scris omul. Un „și-a pus
     telefonul” e de folos când te uiți mai târziu de ce arată altfel foaia;
     numărul lui de telefon în jurnal n-ar ajuta pe nimeni. */
  jurnal.fapta('cont', 'a completat contul', {
    req,
    detalii: {
      tara: tara || '(gol)',
      unitate: unitate || '(după țară)',
      profil: profil || '(gol)',
      completate: Object.keys(LUNGIMI).filter(k => String(brut[k] || '').trim() !== '')
    }
  });

  res.redirect('/cont?salvat=1');
});

/* ---- pentru restul aplicației ---- */

/* Unitatea celui care cere pagina. Un singur loc care hotărăște, ca să nu
   iasă două păreri diferite în două pagini ale aceluiași om. */
function unitatea(req) {
  return PalTari.unitateaLui(req && req.user);
}

/* Datele de pe capul foii de debitare. Întoarce null dacă omul n-a completat
   nimic — atunci foaia rămâne cum era, fără un cap gol care ocupă hârtie. */
function capDeFoaie(utilizator) {
  const u = utilizator || {};
  const rand = [u.firma || u.name, u.oras, u.telefon].filter(Boolean);
  if (!rand.length) return null;
  return {
    nume: u.firma || u.name || '',
    cui: u.cui || '',
    telefon: u.telefon || '',
    oras: u.oras || '',
    adresa: u.adresa || ''
  };
}

/* Rândurile pentru panoul de administrare: cine folosește aplicația și de
   unde. Asta e tot ce se poate ști despre piață fără să întrebi pe nimeni. */
function dupaTara(limita) {
  return db.prepare(
    "SELECT tara, COUNT(*) AS n FROM users " +
    "WHERE tara <> '' GROUP BY tara ORDER BY n DESC, tara LIMIT ?"
  ).all(Math.min(Math.max(Number(limita) || 20, 1), 200));
}

function dupaProfil() {
  return db.prepare(
    "SELECT profil, COUNT(*) AS n FROM users " +
    "WHERE profil <> '' GROUP BY profil ORDER BY n DESC, profil"
  ).all();
}

function citeste(userId) {
  return db.prepare('SELECT ' + COLOANE_UTILIZATOR + ' FROM users WHERE id = ?').get(userId) || null;
}

module.exports = {
  router, PROFILE, LUNGIMI,
  unitatea, capDeFoaie, siteBun, dupaTara, dupaProfil, citeste
};
