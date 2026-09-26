'use strict';
/* Comenzi: materialele alese, corpurile din comandă și listele de producție. */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const credit = require('./credit');
const util = require('./util');
const materiale = require('./materiale');
const Catalog = require('../shared/catalog');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalRaport = require('../shared/raport');
const PalAnsamblu = require('../shared/ansamblu');
const PalFeronerie = require('../shared/feronerie');

const router = express.Router();

const GROSIMI_PAL = [8, 10, 12, 16, 18, 19, 22, 25, 28, 38];
const FORMATE_ID = ['intreaga', 'jum-lat', 'jum-lung', 'sfert'];

/* adaosul la cant e treabă de atelier, nu apare în hârtiile clientului */
const adaosCant = () => Number(process.env.CANT_SPARE_PCT || 15);

const schemaComanda = z.object({
  name: z.string().trim().min(1, 'Dă un nume comenzii.').max(80),
  brand: z.string().trim().min(1).max(40),
  decor_cod: z.string().trim().max(60).optional().or(z.literal('')),
  pal_mm: z.coerce.number().refine(v => GROSIMI_PAL.includes(v), 'Grosime de PAL neacceptată.'),
  cant_gros: z.coerce.number().min(0).max(5),
  cant_subtire: z.coerce.number().min(0).max(5),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  asamblare: z.string().trim().max(30).optional(),
  balama: z.string().trim().max(30).optional(),
  glisiere: z.string().trim().max(30).optional(),
  suspensii: z.any().optional()
});

/* Sistemul de feronerie se alege la deschiderea comenzii: de el depind
   cantitățile din listă și cotele din programul de găurire. */
function feronerieDinBody(body) {
  return PalFeronerie.citeste({
    asamblare: body.asamblare,
    balama: body.balama,
    glisiere: body.glisiere,
    suspensii: body.suspensii === undefined ? false : body.suspensii === 'on' || body.suspensii === '1' || body.suspensii === 'true'
  });
}

function formateDinBody(body) {
  let alese = body.formate;
  if (!alese) return ['intreaga'];
  if (!Array.isArray(alese)) alese = [alese];
  const curate = alese.filter(f => FORMATE_ID.includes(f));
  return curate.length ? curate : ['intreaga'];
}

/* ---------- acces ---------- */

function getOwned(id, userId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));
  return (!o || o.user_id !== userId) ? null : o;
}

function notFound(next) {
  const err = new Error('Comanda nu există.');
  err.status = 404;
  next(err);
}

/* corpurile cu poziția lor în cameră, pentru ansamblu */
function corpuriPozitionate(orderId) {
  return db.prepare('SELECT * FROM corps WHERE order_id = ? ORDER BY poz, id').all(orderId)
    .map(row => ({
      id: row.id,
      nume: row.name,
      poz: row.poz,
      params: Object.assign(PalCalc.defaults(), JSON.parse(row.params)),
      pozitie: row.pozitie
    }));
}

function comandaCuCamera(order) {
  let cam;
  try { cam = JSON.parse(order.camera || '{}'); } catch (e) { cam = {}; }
  return Object.assign({}, order, { camera: PalAnsamblu.camera(cam) });
}

/* Așezarea automată: corpurile adânci merg jos, cele subțiri sus, fiecare grup
   alipit de la un perete la altul. Un corp de colț ocupă și începutul peretelui
   următor, așa că acolo se pornește după el. */
function asazaAutomat(corpuri, cam, inaltimeSus) {
  /* adâncimea reală, nu gabaritul în plan: altfel un colț suspendat, care ocupă
     mult în plan, ar fi luat drept corp de jos */
  const adanc = c => PalAnsamblu.gabarit(c.params).adancimeReala;
  const jos = corpuri.filter(c => adanc(c) >= 450);
  const sus = corpuri.filter(c => adanc(c) < 450);
  const pereti = ['A', 'B', 'C', 'D'];
  const pozitii = [];

  const aseaza = (lista, h) => {
    let iPerete = 0;
    let d = 0;
    let offsetUrmator = 0;

    lista.forEach(c => {
      const g = PalAnsamblu.gabarit(c.params);
      let lung = PalAnsamblu.lungimePerete(cam, pereti[iPerete]);

      /* dacă nu mai încape, trecem pe peretele următor */
      while (d + g.latime > lung + 0.5 && iPerete < pereti.length - 1) {
        iPerete++;
        d = offsetUrmator;
        offsetUrmator = 0;
        lung = PalAnsamblu.lungimePerete(cam, pereti[iPerete]);
      }

      pozitii.push({ id: c.id, perete: pereti[iPerete], d: Math.round(d * 10) / 10, h });
      d += g.latime;
      if (g.colt) offsetUrmator = g.W2;     /* colțul mănâncă și din peretele următor */
    });
  };

  aseaza(jos, 0);
  aseaza(sus, inaltimeSus);
  return pozitii;
}

function corpuriComenzii(orderId, mats) {
  const roluri = materiale.peRoluri(mats || materiale.aleComenzii(orderId));
  const dupaId = {};
  (mats || []).forEach(m => { dupaId[m.id] = m; });

  return db.prepare('SELECT * FROM corps WHERE order_id = ? ORDER BY poz, id').all(orderId)
    .map(row => ({
      id: row.id,
      name: row.name,
      poz: row.poz,
      params: Object.assign(PalCalc.defaults(), JSON.parse(row.params)),
      matCorpId: row.mat_corp_id,
      matFrontId: row.mat_front_id,
      materiale: {
        corp: dupaId[row.mat_corp_id] || roluri.corp,
        front: dupaId[row.mat_front_id] || roluri.front,
        sertar: roluri.sertar
      }
    }));
}

function raportComenzii(order, optiuni) {
  const mats = materiale.aleComenzii(order.id);
  const corpuri = corpuriComenzii(order.id, mats);
  const comanda = Object.assign({}, order, {
    materiale: mats,
    formate: JSON.parse(order.formate || '["intreaga"]'),
    feronerie: PalFeronerie.citeste(order.feronerie)
  });
  return PalRaport.raport(comanda, corpuri,
    Object.assign({ effortMs: 250, adaosCant: adaosCant() }, optiuni || {}));
}

/* ---------- lista de comenzi ---------- */

router.get('/orders', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*,
           (SELECT COUNT(*) FROM corps c WHERE c.order_id = o.id) AS nrCorpuri,
           (SELECT COUNT(*) FROM order_materials m WHERE m.order_id = o.id) AS nrMateriale
    FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC
  `).all(req.user.id);

  rows.forEach(o => {
    o.materiale = db.prepare('SELECT * FROM order_materials WHERE order_id = ? ORDER BY poz LIMIT 3')
                    .all(o.id);
  });

  res.render('orders/index', {
    title: 'Comenzile mele',
    comenzi: rows,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp()
  });
});

router.get('/orders/new', requireAuth, (req, res) => {
  res.render('orders/new', {
    title: 'Comandă nouă',
    marci: Catalog.MARCI,
    grosimi: GROSIMI_PAL,
    cantStandard: materiale.CANT_STANDARD,
    feroOptiuni: PalFeronerie.optiuni(),
    values: Object.assign({ name: '', brand: 'Egger', decor_cod: '', pal_mm: 18,
              cant_gros: 2, cant_subtire: 0.4, note: '', formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert'] },
              PalFeronerie.implicit()),
    error: null
  });
});

router.post('/orders', requireAuth, (req, res) => {
  const parsed = schemaComanda.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('orders/new', {
      title: 'Comandă nouă',
      marci: Catalog.MARCI, grosimi: GROSIMI_PAL, cantStandard: materiale.CANT_STANDARD,
      feroOptiuni: PalFeronerie.optiuni(),
      values: Object.assign({}, req.body, { formate: formateDinBody(req.body) },
                            feronerieDinBody(req.body)),
      error: parsed.error.issues[0].message
    });
  }

  const d = parsed.data;
  const brand = Catalog.numeMarca(d.brand);
  const decor = d.decor_cod ? Catalog.decor(brand, d.decor_cod) : null;

  const creeaza = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, name, brand, decor, cant_decor, pal_mm, cant_gros, cant_subtire,
                          adaos_cant, note, formate, feronerie)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, d.name, brand, decor ? decor.cod : null, null,
           d.pal_mm, d.cant_gros, d.cant_subtire, adaosCant(), d.note || null,
           JSON.stringify(formateDinBody(req.body)),
           JSON.stringify(feronerieDinBody(req.body)));

    const orderId = Number(info.lastInsertRowid);
    materiale.creeaza(orderId, {
      nume: decor ? (decor.nume + ' ' + decor.cod) : 'Material principal',
      rol: 'corp', brand,
      decor_cod: decor ? decor.cod : '',
      pal_mm: d.pal_mm, cant_gros: d.cant_gros, cant_subtire: d.cant_subtire,
      cant_decor_cod: decor ? decor.cod : ''
    });
    return orderId;
  });

  res.redirect(`/orders/${creeaza()}`);
});

/* ---------- o comandă ---------- */

router.get('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order);

  res.render('orders/show', {
    title: order.name,
    order, raport,
    materiale: materiale.aleComenzii(order.id),
    roluri: materiale.ROLURI,
    marci: Catalog.MARCI,
    grosimi: GROSIMI_PAL,
    cantStandard: materiale.CANT_STANDARD,
    formateId: FORMATE_ID,
    formateAlese: JSON.parse(order.formate || '["intreaga"]'),
    formateToate: PalRaport.FORMATE,
    feroOptiuni: PalFeronerie.optiuni(),
    feroAles: PalFeronerie.citeste(order.feronerie),
    feroSistem: PalFeronerie.sistem(order.feronerie),
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp(),
    adaugat: req.query.adaugat === '1'
  });
});

router.post('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const name = String(req.body.name || order.name).trim().slice(0, 80) || order.name;
  const note = String(req.body.note || '').trim().slice(0, 500);

  db.prepare(`UPDATE orders SET name = ?, note = ?, formate = ?, updated_at = datetime('now')
              WHERE id = ?`)
    .run(name, note || null, JSON.stringify(formateDinBody(req.body)), order.id);

  res.redirect(`/orders/${order.id}`);
});

/* Feroneria se poate schimba și după deschiderea comenzii, atâta timp cât
   piesele n-au plecat la debitat: recalculează cantitățile și găurile. */
router.post('/orders/:id/feronerie', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  db.prepare(`UPDATE orders SET feronerie = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(feronerieDinBody(req.body)), order.id);

  res.redirect(`/orders/${order.id}#feronerie`);
});

router.post('/orders/:id/delete', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);
  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  res.redirect('/orders');
});

/* ---------- adăugarea unui corp (aici se consumă creditul) ---------- */

router.get('/orders/:id/corp-nou', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const models = PalModels.MODELS.map(m => {
    const params = PalModels.paramsFor(m.id);
    return {
      id: m.id, cat: m.cat, nume: m.nume, descriere: m.descriere,
      params, rezumat: PalModels.rezumat(params), sketch: PalModels.sketch(params)
    };
  });

  res.render('corps/new', {
    title: 'Adaugă un corp',
    categories: PalModels.CATEGORIES,
    models, order,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp()
  });
});

const adaugaCorp = db.transaction((userId, order, params, cost, matCorpId) => {
  const ramas = credit.scade(userId, cost, 'corp', null, 'corp în comanda „' + order.name + '”');
  if (ramas === null) throw new Error('CREDIT_INSUFICIENT');

  const poz = db.prepare('SELECT COALESCE(MAX(poz), 0) AS m FROM corps WHERE order_id = ?')
                .get(order.id).m + 1;
  const info = db.prepare(
    'INSERT INTO corps (user_id, order_id, name, params, status, poz, mat_corp_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, order.id, params.nume, JSON.stringify(params), 'paid', poz, matCorpId);

  const corpId = Number(info.lastInsertRowid);
  db.prepare('UPDATE credit_tx SET ref = ? WHERE id = (SELECT MAX(id) FROM credit_tx WHERE user_id = ?)')
    .run(String(corpId), userId);
  return corpId;
});

router.post('/orders/:id/corps', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const params = req.body.model ? PalModels.paramsFor(String(req.body.model)) : PalCalc.defaults();
  if (!params) {
    return next(Object.assign(new Error('Model necunoscut.'), { status: 400 }));
  }

  const mats = materiale.aleComenzii(order.id);
  const roluri = materiale.peRoluri(mats);
  const matCorp = roluri.corp;

  /* materialul comenzii dă grosimea plăcii și canturile */
  if (matCorp) {
    params.t = matCorp.pal_mm;
    params.cg = matCorp.cant_gros;
    params.cs = matCorp.cant_subtire;
  }

  try {
    const corpId = adaugaCorp(req.user.id, order, params, credit.pretCorp(), matCorp ? matCorp.id : null);
    res.redirect(`/corps/${corpId}`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

/* materialul unui corp (carcasă / fronturi) */
router.post('/corps/:id/material', requireAuth, (req, res, next) => {
  const corp = db.prepare('SELECT * FROM corps WHERE id = ?').get(Number(req.params.id));
  if (!corp || corp.user_id !== req.user.id) {
    return next(Object.assign(new Error('Corpul nu există.'), { status: 404 }));
  }

  const ale = corp.order_id ? materiale.aleComenzii(corp.order_id) : [];
  const valid = id => (id && ale.some(m => m.id === Number(id))) ? Number(id) : null;
  const matCorp = valid(req.body.mat_corp_id);
  const matFront = valid(req.body.mat_front_id);

  db.prepare("UPDATE corps SET mat_corp_id = ?, mat_front_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(matCorp, matFront, corp.id);

  /* grosimea și cantul carcasei intră în parametrii corpului */
  if (matCorp) {
    const m = ale.find(x => x.id === matCorp);
    const params = Object.assign(PalCalc.defaults(), JSON.parse(corp.params),
      { t: m.pal_mm, cg: m.cant_gros, cs: m.cant_subtire });
    db.prepare('UPDATE corps SET params = ? WHERE id = ?').run(JSON.stringify(params), corp.id);
  }

  res.redirect(`/corps/${corp.id}`);
});

/* ---------- ansamblul: corpurile alipite în cameră ---------- */

router.get('/orders/:id/ansamblu', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cu = comandaCuCamera(order);
  const corpuri = corpuriPozitionate(order.id);
  const ans = PalAnsamblu.ansamblu(cu, corpuri);

  res.render('orders/ansamblu', {
    title: 'Ansamblu – ' + order.name,
    order: cu,
    ansamblu: ans,
    pereti: PalAnsamblu.PERETI,
    elevatie: PalAnsamblu.elevatie,
    corpuri
  });
});

const schemaCamera = z.object({
  A: z.coerce.number().min(500).max(20000),
  B: z.coerce.number().min(500).max(20000),
  H: z.coerce.number().min(1500).max(5000)
});

router.post('/orders/:id/camera', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const parsed = schemaCamera.safeParse(req.body);
  if (!parsed.success) {
    return next(Object.assign(new Error(parsed.error.issues[0].message), { status: 400 }));
  }
  db.prepare("UPDATE orders SET camera = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(parsed.data), order.id);
  res.redirect(`/orders/${order.id}/ansamblu`);
});

router.post('/orders/:id/aseaza', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cu = comandaCuCamera(order);
  const corpuri = corpuriPozitionate(order.id);
  const inaltimeSus = Math.min(2400, Math.max(0, Number(req.body.inaltime_sus) || 1400));
  const pozitii = asazaAutomat(corpuri, cu.camera, inaltimeSus);

  const upd = db.prepare("UPDATE corps SET pozitie = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
  db.transaction(() => {
    pozitii.forEach(p => upd.run(JSON.stringify({ perete: p.perete, d: p.d, h: p.h }), p.id, req.user.id));
  })();

  res.redirect(`/orders/${order.id}/ansamblu`);
});

router.post('/corps/:id/pozitie', requireAuth, (req, res, next) => {
  const corp = db.prepare('SELECT * FROM corps WHERE id = ?').get(Number(req.params.id));
  if (!corp || corp.user_id !== req.user.id) {
    return next(Object.assign(new Error('Corpul nu există.'), { status: 404 }));
  }

  const perete = PalAnsamblu.peretele(String(req.body.perete || 'A')).id;
  const d = Math.max(0, Number(req.body.d) || 0);
  const h = Math.max(0, Number(req.body.h) || 0);

  db.prepare("UPDATE corps SET pozitie = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify({ perete, d, h }), corp.id);

  res.redirect(`/orders/${corp.order_id}/ansamblu`);
});

/* datele ansamblului pentru vederea 3D din pagină */
router.get('/api/orders/:id/ansamblu', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cu = comandaCuCamera(order);
  const corpuri = corpuriPozitionate(order.id);
  const ans = PalAnsamblu.ansamblu(cu, corpuri);

  res.json({
    camera: ans.camera,
    corpuri: ans.asezari.map(a => {
      const c = corpuri.filter(x => x.id === a.id)[0];
      const rez = PalCalc.calc(c.params);
      return {
        id: a.id, nume: a.nume,
        origine: a.origine, rotatie: a.rotatie,
        piese: rez.P.map(p => ({ nume: p.nume, boxes: p.boxes }))
      };
    })
  });
});

/* ---------- listele de producție ---------- */

const PRINTURI = {
  ansamblu: { view: 'orders/print-ansamblu', titlu: 'Planșă de ansamblu' },
  corpuri: { view: 'orders/print-corpuri', titlu: 'Listă corpuri' },
  debitare: { view: 'orders/print-debitare', titlu: 'Listă piese pentru debitare' },
  incadrare: { view: 'orders/print-incadrare', titlu: 'Încadrarea în coli' },
  montaj: { view: 'orders/print-montaj', titlu: 'Fișe de montaj' },
  cnc: { view: 'orders/print-cnc', titlu: 'Prelucrări CNC' }
};

router.get('/orders/:id/print/:tip', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cfg = PRINTURI[req.params.tip];
  if (!cfg) return notFound(next);

  const raport = raportComenzii(order);
  const cu = comandaCuCamera(order);
  const ans = PalAnsamblu.ansamblu(cu, corpuriPozitionate(order.id));

  res.render(cfg.view, {
    title: cfg.titlu + ' – ' + order.name,
    titlu: cfg.titlu,
    order: cu, raport,
    ansamblu: ans,
    pereti: PalAnsamblu.PERETI,
    elevatie: PalAnsamblu.elevatie,
    materiale: materiale.aleComenzii(order.id),
    planse: PalRaport.planseCnc,
    planColi: PalRaport.planColi,
    /* adaosul la cant rămâne intern: clientul vede metrii exacți */
    aratAdaos: !!req.user.is_admin,
    print: true
  });
});

/* ---------- export CSV pentru fabrică ---------- */

router.get('/orders/:id/export.csv', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order);
  const head = ['Corp', 'Cod', 'Piesa', 'Buc', 'Taiere L', 'Taiere l', 'Material', 'Decor',
                'Cant L1', 'Cant L2', 'Cant l1', 'Cant l2', 'Fibra', 'CNC', 'Nota'];
  const linii = [head.join(';')];

  raport.piese.forEach(p => {
    linii.push([
      p.corpNume, p.cod, p.nume, p.buc, p.TL, p.Tl,
      p.material.tip + ' ' + p.material.gros,
      p.material.decorNume || p.material.decor || '',
      p.cant.muchii[0], p.cant.muchii[1], p.cant.muchii[2], p.cant.muchii[3],
      p.fibra, p.cnc ? 'DA' : '', p.nota
    ].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', util.dispozitieAtasament('debitare-' + order.name));
  res.send('﻿' + linii.join('\n'));
});

module.exports = { router, getOwned, corpuriComenzii, raportComenzii, GROSIMI_PAL, FORMATE_ID, adaosCant };
