'use strict';
/* Panou de administrare: utilizatori, corpuri, plati, total incasat. */

const express = require('express');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const mesaje = require('./mesaje');
const jurnal = require('./jurnal');
const cont = require('./cont');
const statistici = require('./statistici');
const PalTari = require('../shared/tari');
const setari = require('./setari');
const plati = require('./payments');
const { eLocal } = require('./pornire');

const router = express.Router();

router.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.is_admin, u.created_at, u.credit_cents,
           (SELECT COUNT(*) FROM corps c WHERE c.user_id = u.id) AS corps,
           (SELECT COUNT(*) FROM corps c WHERE c.user_id = u.id AND c.status = 'paid') AS paid,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS comenzi
    FROM users u ORDER BY u.created_at DESC, u.id DESC
  `).all();

  const corps = db.prepare(`
    SELECT c.id, c.name, c.status, c.created_at, c.updated_at, u.email
    FROM corps c JOIN users u ON u.id = c.user_id
    ORDER BY c.updated_at DESC, c.id DESC LIMIT 100
  `).all();

  const payments = db.prepare(`
    SELECT p.id, p.provider, p.provider_ref, p.amount_cents, p.currency, p.status,
           p.created_at, u.email, c.name AS corp_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN corps c ON c.id = p.corp_id
    ORDER BY p.created_at DESC, p.id DESC LIMIT 100
  `).all();

  const totals = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS n
    FROM payments WHERE status = 'paid'
  `).get();

  res.render('admin', {
    title: 'Administrare',
    users, corps, payments,
    /* Cine folosește aplicația și de unde. Numele țării se face în limba
       celui care se uită, nu în engleză. */
    tari: cont.dupaTara(30),
    profile: cont.dupaProfil(),
    numeTara: (cod) => PalTari.numeTara(cod, req.lang),
    mesaje: mesaje.ultimele(100),
    mesajeNoi: mesaje.cateNoi(),
    totalLei: (totals.cents / 100).toFixed(2),
    totalCount: totals.n
  });
});

/* Ce se lucrează, pe țări. Constantele românești din aplicație sunt măsurate
   în atelierul care a cerut-o; pentru orice altă țară n-avem nicio
   măsurătoare, și nici nu se poate lua din cărți. Aici se numără ce lucrează
   oamenii, din corpurile pe care le-au salvat deja. */
router.get('/admin/statistici', requireAuth, requireAdmin, (req, res) => {
  /* Fără parametru: toate țările la un loc. Cu el: o țară anume, iar șirul
     gol e o alegere adevărată — conturile care n-au spus de unde sunt. */
  const tara = req.query.tara === undefined ? null : String(req.query.tara);

  res.render('admin/statistici', {
    title: req.t('stat.titlu'),
    r: statistici.raport(tara),
    tari: statistici.tari(),
    taraAleasa: tara,
    numeTara: (cod) => PalTari.numeTara(cod, req.lang),
    /* Cotele și constantele au DEJA nume traduse în editor, în toate cele
       treizeci de limbi. Se folosesc alea, nu se scriu altele: un vocabular
       paralel ar însemna trei sute de termeni de tâmplărie inventați de noi
       în limbi pe care nu le citește nimeni din atelier — și, mai rău, alt
       cuvânt aici decât cel pe care-l vede omul în editor. */
    numeCota: { W: 'editor.latime', H: 'editor.inaltime', D: 'editor.adancime' },
    numeConstanta: {
      t: 'editor.palMm', ts: 'editor.palCutie', tp: 'editor.grosimeSpate',
      cg: 'editor.cantGros', cs: 'editor.cantSubtire',
      rm: 'editor.rostMargine', ri: 'editor.rostIntreFronturi',
      rinc: 'editor.rostIncastrat', rp: 'editor.retragereFata',
      jp: 'editor.jocLateral', jg: 'editor.jocGlisiera'
    }
  });
});

/* Jurnalul: ce s-a rupt si ce s-a intamplat, in ordine. Filtrele sunt
   putine inadins — un panou cu cincisprezece casute nu se foloseste. */
router.get('/admin/jurnal', requireAuth, requireAdmin, (req, res) => {
  const nivel = jurnal.NIVELE.indexOf(req.query.nivel) !== -1 ? req.query.nivel : null;
  const sursa = req.query.sursa || null;

  res.render('admin/jurnal', {
    title: req.t('jurnal.titlu'),
    randuri: jurnal.ultimele({ nivel, sursa, limita: 300 }),
    numere: jurnal.numaratoare(),
    surse: jurnal.surse(),
    nivele: jurnal.NIVELE,
    nivelAles: nivel,
    sursaAleasa: sursa,
    zile: jurnal.ZILE,
    maxim: jurnal.MAXIM
  });
});

/* Plata: driverul (credit virtual de probă sau Stripe) și cheile Stripe.
   ------------------------------------------------------------
   Aici se pun, nu în .env pe server. Cheile se verifică la Stripe ÎNAINTE
   de salvare — o cheie greșită salvată s-ar vedea abia la prima plată a
   unui client, adică exact când doare. Iar secretul webhook-ului îl face
   aplicația singură în Stripe, ca omul să nu-l caute prin panoul lor. */

/* Adresa la care Stripe trimite confirmările. Doar pe https: Stripe nu
   trimite la http, iar pe localhost n-are cum ajunge. */
function adresaWebhook() {
  const url = plati.appUrl();
  return /^https:\/\//.test(url) && !eLocal(url) ? plati.webhookUrl() : null;
}

router.get('/admin/plata', requireAuth, requireAdmin, (req, res) => {
  const flash = req.session.plataFlash || {};
  delete req.session.plataFlash;
  const cheie = setari.citeste('STRIPE_SECRET_KEY');
  const webhook = setari.citeste('STRIPE_WEBHOOK_SECRET');

  res.render('admin/plata', {
    title: req.t('admin.plata.titlu'),
    stare: plati.stare(),
    cheie: { masca: setari.mascheaza(cheie), sursa: setari.sursa('STRIPE_SECRET_KEY') },
    webhook: { masca: setari.mascheaza(webhook), sursa: setari.sursa('STRIPE_WEBHOOK_SECRET') },
    necitite: setari.necitite().length > 0,
    adresaWebhook: adresaWebhook(),
    ok: flash.ok || [],
    erori: flash.erori || [],
    contStripe: flash.contStripe || ''
  });
});

router.post('/admin/plata', requireAuth, requireAdmin, async (req, res, next) => {
  const ok = [];
  const erori = [];
  let contStripe = '';
  const uid = req.user.id;
  const t = req.t;

  try {
    if (req.body.sterge === '1') {
      setari.sterge('STRIPE_SECRET_KEY');
      setari.sterge('STRIPE_WEBHOOK_SECRET');
      setari.pune('PAYMENT_DRIVER', 'fake', uid);
      ok.push(t('admin.plata.sters'));
      jurnal.fapta('plata', 'cheile Stripe șterse din aplicație', { req });
    } else {
      const cheie = String(req.body.cheie || '').trim();
      const whsec = String(req.body.whsec || '').trim();

      /* ---- cheia secretă: format, apoi Stripe ---- */
      let cheieBuna = false;
      if (cheie) {
        if (!plati.FORMAT_CHEIE.test(cheie)) {
          erori.push(t('admin.plata.eroareFormat'));
        } else {
          try {
            contStripe = (await plati.verificaCheie(cheie)).cont;
            setari.pune('STRIPE_SECRET_KEY', cheie, uid);
            cheieBuna = true;
            ok.push(t('admin.plata.cheieSalvata'));
            jurnal.fapta('plata', 'cheia Stripe schimbată', {
              req, detalii: { mod: /_live_/.test(cheie) ? 'live' : 'test' }
            });
          } catch (e) {
            erori.push(t('admin.plata.eroareStripe', { mesaj: e.message }));
          }
        }
      }

      /* ---- secretul webhook-ului: pus de mână, sau făcut singur ---- */
      if (whsec) {
        if (!plati.FORMAT_WEBHOOK.test(whsec)) {
          erori.push(t('admin.plata.eroareFormatWebhook'));
        } else {
          setari.pune('STRIPE_WEBHOOK_SECRET', whsec, uid);
          ok.push(t('admin.plata.webhookSalvat'));
          jurnal.fapta('plata', 'secretul webhook-ului pus de mână', { req });
        }
      } else if (cheieBuna && adresaWebhook()) {
        /* Cheie nouă = poate alt cont Stripe, deci și webhook nou. */
        try {
          const secret = await plati.facWebhook(cheie, adresaWebhook());
          setari.pune('STRIPE_WEBHOOK_SECRET', secret, uid);
          ok.push(t('admin.plata.webhookFacut'));
          jurnal.fapta('plata', 'webhook făcut în Stripe', { req, detalii: { url: adresaWebhook() } });
        } catch (e) {
          erori.push(t('admin.plata.eroareWebhook', { mesaj: e.message }));
        }
      }

      /* ---- driverul ---- */
      const driver = req.body.driver === 'stripe' ? 'stripe' : 'fake';
      if (driver !== plati.driver()) {
        if (driver === 'stripe' &&
            !(setari.citeste('STRIPE_SECRET_KEY') && setari.citeste('STRIPE_WEBHOOK_SECRET'))) {
          erori.push(t('admin.plata.eroareFaraChei'));
        } else {
          setari.pune('PAYMENT_DRIVER', driver, uid);
          ok.push(t(driver === 'stripe' ? 'admin.plata.pornitStripe' : 'admin.plata.pornitFake'));
          jurnal.fapta('plata', 'felul plății schimbat', { req, detalii: { driver } });
        }
      }
    }

    req.session.plataFlash = { ok, erori, contStripe };
    res.redirect('/admin/plata');
  } catch (e) { next(e); }
});

module.exports = { router };
