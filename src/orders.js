'use strict';
/* Comenzi: materialele alese, corpurile din comandă și listele de producție. */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const credit = require('./credit');
const util = require('./util');
const jurnal = require('./jurnal');
const materiale = require('./materiale');
const Catalog = require('../shared/catalog');
const PalCalc = require('../shared/calc');
const PalModels = require('../shared/models');
const PalRaport = require('../shared/raport');
const PalFisa = require('../shared/fisa-piesa');
const PalAnsamblu = require('../shared/ansamblu');
const PalFeronerie = require('../shared/feronerie');

const router = express.Router();

const GROSIMI_PAL = [8, 10, 12, 16, 18, 19, 22, 25, 28, 38];
const FORMATE_ID = ['intreaga', 'jum-lat', 'jum-lung', 'sfert'];

/* adaosul la cant e treabă de atelier, nu apare în hârtiile clientului */
const adaosCant = () => Number(process.env.CANT_SPARE_PCT || 15);

const schemaComanda = z.object({
  name: z.string().trim().min(1, 'valid.numeComanda').max(80),
  brand: z.string().trim().min(1).max(40),
  decor_cod: z.string().trim().max(60).optional().or(z.literal('')),
  pal_mm: z.coerce.number().refine(v => GROSIMI_PAL.includes(v), 'valid.grosimeNeacceptata'),
  cant_gros: z.coerce.number().min(0).max(5),
  cant_subtire: z.coerce.number().min(0).max(5),
  /* Al doilea decor, al fronturilor. Tot pe `.catch()` și `.optional()`:
     casetele lui sunt ascunse până se bifează, iar un formular trimis fără
     ele nu e o greșeală, e cazul obișnuit — o comandă dintr-un singur
     decor. O comandă întreagă nu se pierde fiindcă lipsește un câmp pe
     care omul nici nu l-a văzut. */
  front_alt: z.any().optional(),
  brand_front: z.string().trim().max(40).optional().or(z.literal('')),
  decor_cod_front: z.string().trim().max(60).optional().or(z.literal('')),
  pal_mm_front: z.coerce.number().catch(0),
  cant_gros_front: z.coerce.number().min(0).max(5).catch(0),
  cant_subtire_front: z.coerce.number().min(0).max(5).catch(0),
  /* Cutiile de sertar sunt treabă de carcasă: din decorul ei se fac, și așa
     rămâne dacă nu zice nimeni altceva. */
  sertare_din: z.enum(['corp', 'front']).catch('corp'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  /* Data livrarii ca text ISO, cum vine din <input type="date">. Goala e in
     regula: la deschiderea comenzii de multe ori inca nu se stie. */
  livrare_la: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'valid.dataLivrarii')
               .optional().or(z.literal('')),
  /* Telefonul nu se verifica pe forma: prefixe, spatii, paranteze si
     interioare arata altfel in fiecare tara, iar o regula stramta ar
     respinge numere bune. Ii punem doar o lungime. */
  telefon: z.string().trim().max(40).optional().or(z.literal('')),
  asamblare: z.string().trim().max(30).optional(),
  balama: z.string().trim().max(30).optional(),
  glisiere: z.string().trim().max(30).optional(),
  plinta: z.string().trim().max(30).optional(),
  suspensii: z.any().optional()
});

/* Sistemul de feronerie se alege la deschiderea comenzii: de el depind
   cantitățile din listă și cotele din programul de găurire. */
function feronerieDinBody(body) {
  return PalFeronerie.citeste({
    asamblare: body.asamblare,
    balama: body.balama,
    glisiere: body.glisiere,
    plinta: body.plinta,
    suspensii: body.suspensii === undefined ? false : body.suspensii === 'on' || body.suspensii === '1' || body.suspensii === 'true'
  });
}

/* Materialul de fronturi, așa cum vine din formular.

   Întoarce `null` când nu s-a cerut al doilea decor — cazul obișnuit — sau
   când s-a bifat caseta și n-a fost ales niciun decor. Fără decor n-avem ce
   pune pe rând: un material fără decor n-ar fi decât încă o linie goală în
   comandă, pe care omul ar trebui s-o șteargă pe urmă.

   Ce lipsește se ia de la carcasă: grosimea și cantul fronturilor sunt de
   obicei aceleași, iar o comandă cu 0 pe ele ar fi mai rea decât una cu
   valorile carcasei. */
function materialFronturi(d) {
  const cerut = d.front_alt === '1' || d.front_alt === 'on' || d.front_alt === true;
  if (!cerut || !d.decor_cod_front) return null;
  const brand = Catalog.numeMarca(d.brand_front || d.brand);
  const decor = Catalog.decor(brand, d.decor_cod_front);
  if (!decor) return null;
  return {
    brand: brand,
    decor: decor,
    pal_mm: d.pal_mm_front || d.pal_mm,
    cant_gros: d.cant_gros_front || d.cant_gros,
    cant_subtire: d.cant_subtire_front || d.cant_subtire
  };
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
  next(util.eroare('eroare.comandaLipsa', 404));
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

/* `t` e al doilea argument, pozițional și obligatoriu, înadins: raport()
   traduce numele pieselor, notele de tăiere, formatele de coală, feroneria și
   operațiile CNC. Fără el, PalCalc.traducator(undefined) cade pe română fără
   să crâcnească — exact așa a ajuns toată lista de debitare în română în
   celelalte 29 de limbi. Dacă adaugi un apel nou, dă-i `req.t`. */
function raportComenzii(order, t, optiuni) {
  const mats = materiale.aleComenzii(order.id);
  const corpuri = corpuriComenzii(order.id, mats);
  const comanda = Object.assign({}, order, {
    materiale: mats,
    formate: JSON.parse(order.formate || '["intreaga"]'),
    feronerie: PalFeronerie.citeste(order.feronerie)
  });
  return PalRaport.raport(comanda, corpuri,
    Object.assign({ t: t, effortMs: 250, adaosCant: adaosCant() }, optiuni || {}));
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
    title: req.t('comenzi.titlu'),
    comenzi: rows,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp()
  });
});

router.get('/orders/new', requireAuth, (req, res) => {
  res.render('orders/new', {
    title: req.t('comandaNoua.titlu'),
    marci: Catalog.MARCI,
    grosimi: GROSIMI_PAL,
    cantStandard: materiale.CANT_STANDARD,
    cantPentru: materiale.cantPentru, cantScos: materiale.CANT_SCOS,
    formateToate: PalRaport.formate(req.t),
    formateId: FORMATE_ID,
    feroOptiuni: PalFeronerie.optiuni(req.t),
    /* Telefonul vine din cont: e același la fiecare comandă, iar cine îl are
       pus o dată nu-l mai scrie de zece ori. Rămâne un câmp de formular, deci
       se poate schimba pentru o comandă anume fără să atingă contul. */
    values: Object.assign({ name: '', brand: 'Egger', decor_cod: '', pal_mm: 18,
              cant_gros: 2, cant_subtire: 0.8, note: '', livrare_la: '',
              telefon: req.user.telefon || '',
              formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert'] },
              PalFeronerie.implicit()),
    error: null
  });
});

router.post('/orders', requireAuth, (req, res) => {
  const parsed = schemaComanda.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('orders/new', {
      title: req.t('comandaNoua.titlu'),
      marci: Catalog.MARCI, grosimi: GROSIMI_PAL, cantStandard: materiale.CANT_STANDARD,
    cantPentru: materiale.cantPentru, cantScos: materiale.CANT_SCOS,
      formateToate: PalRaport.formate(req.t),
      formateId: FORMATE_ID,
      feroOptiuni: PalFeronerie.optiuni(req.t),
      values: Object.assign({}, req.body, { formate: formateDinBody(req.body) },
                            feronerieDinBody(req.body)),
      error: req.t(parsed.error.issues[0].message)
    });
  }

  const d = parsed.data;
  const brand = Catalog.numeMarca(d.brand);
  const decor = d.decor_cod ? Catalog.decor(brand, d.decor_cod) : null;

  const creeaza = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, name, brand, decor, cant_decor, pal_mm, cant_gros, cant_subtire,
                          adaos_cant, note, formate, feronerie, livrare_la, telefon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, d.name, brand, decor ? decor.cod : null, null,
           d.pal_mm, d.cant_gros, d.cant_subtire, adaosCant(), d.note || null,
           JSON.stringify(formateDinBody(req.body)),
           JSON.stringify(feronerieDinBody(req.body)),
           d.livrare_la || null, d.telefon || null);

    const orderId = Number(info.lastInsertRowid);
    materiale.creeaza(orderId, {
      nume: decor ? (decor.nume + ' ' + decor.cod) : 'Material principal',
      rol: 'corp', brand,
      decor_cod: decor ? decor.cod : '',
      pal_mm: d.pal_mm, cant_gros: d.cant_gros, cant_subtire: d.cant_subtire,
      cant_decor_cod: decor ? decor.cod : ''
    });

    /* Al doilea decor, al fronturilor. Fără el, `peRoluri()` trimite
       fronturile pe materialul carcasei — adică o comandă dintr-un singur
       decor, cum a fost dintotdeauna. */
    const fr = materialFronturi(d);
    if (fr) {
      const randFront = {
        nume: fr.decor.nume + ' ' + fr.decor.cod,
        rol: 'front', brand: fr.brand, decor_cod: fr.decor.cod,
        pal_mm: fr.pal_mm, cant_gros: fr.cant_gros, cant_subtire: fr.cant_subtire,
        cant_decor_cod: fr.decor.cod
      };
      materiale.creeaza(orderId, randFront);
      /* Cutiile din decorul fronturilor cer un rând al lor: un rând are UN
         rol, iar `peRoluri()` caută rândul de sertare, nu se uită la cel de
         fronturi. Două rânduri cu același decor nu dublează nimic la
         cumpărat — croirea le pune în aceeași grupă, că au aceeași placă. */
      if (d.sertare_din === 'front') {
        materiale.creeaza(orderId, Object.assign({}, randFront, { rol: 'sertar' }));
      }
    }
    return orderId;
  });

  res.redirect(`/orders/${creeaza()}`);
});

/* ---------- o comandă ---------- */

router.get('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order, req.t);

  /* Desenul fiecarui corp, ca sa se vada ce e in comanda, nu doar cum se
     cheama. Un rand care zice „Corp bază 2 uși · 800 × 720 × 560" nu-ti
     spune daca e cel cu sertare sau cel cu polite. */
  raport.corpuri.forEach(c => { c.desen = PalModels.sketch(c.params); });

  res.render('orders/show', {
    title: order.name,
    order, raport,
    materiale: materiale.aleComenzii(order.id),
    roluri: materiale.roluri(req.t),
    marci: Catalog.MARCI,
    grosimi: GROSIMI_PAL,
    cantStandard: materiale.CANT_STANDARD,
    cantPentru: materiale.cantPentru, cantScos: materiale.CANT_SCOS,
    formateId: FORMATE_ID,
    formateAlese: JSON.parse(order.formate || '["intreaga"]'),
    formateToate: PalRaport.formate(req.t),
    feroOptiuni: PalFeronerie.optiuni(req.t),
    feroAles: PalFeronerie.citeste(order.feronerie),
    feroSistem: PalFeronerie.sistem(order.feronerie, req.t),
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp(),
    adaugat: req.query.adaugat === '1',
    /* Panoul de feronerie sta strans. Se deschide numai cand cineva vine
       anume dupa el — din legatura „schimba sistemul" sau intors de la
       salvare. Un `#feronerie` singur ar duce omul in dreptul unui panou
       inchis, iar CSS nu poate deschide un <details>. */
    deschideFeronerie: req.query.fero === '1'
  });
});

router.post('/orders/:id', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const name = String(req.body.name || order.name).trim().slice(0, 80) || order.name;
  const note = String(req.body.note || '').trim().slice(0, 500);
  /* O data scrisa stramb nu se salveaza, dar nici nu rupe restul
     formularului: ramane cea de dinainte. Goala inseamna „sterge-o". */
  const livrareBruta = String(req.body.livrare_la || '').trim();
  const livrare = /^\d{4}-\d{2}-\d{2}$/.test(livrareBruta) ? livrareBruta
                : (livrareBruta === '' ? null : order.livrare_la);
  const telefon = String(req.body.telefon || '').trim().slice(0, 40);

  db.prepare(`UPDATE orders SET name = ?, note = ?, formate = ?, livrare_la = ?, telefon = ?,
                     updated_at = datetime('now')
              WHERE id = ?`)
    .run(name, note || null, JSON.stringify(formateDinBody(req.body)),
         livrare, telefon || null, order.id);

  res.redirect(`/orders/${order.id}`);
});

/* Feroneria se poate schimba și după deschiderea comenzii, atâta timp cât
   piesele n-au plecat la debitat: recalculează cantitățile și găurile. */
router.post('/orders/:id/feronerie', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  db.prepare(`UPDATE orders SET feronerie = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(feronerieDinBody(req.body)), order.id);

  /* Intors la panoul deschis: omul tocmai a schimbat sistemul si trebuie sa
     vada ce-a iesit, nu un panou strans si o pagina care pare neatinsa. */
  res.redirect(`/orders/${order.id}?fero=1#feronerie`);
});

router.post('/orders/:id/delete', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);
  /* O comanda pleaca cu tot cu corpurile ei. Numaram inainte, ca dupa nu
     mai avem de unde. */
  const cateCorpuri = db.prepare('SELECT COUNT(*) n FROM corps WHERE order_id = ?').get(order.id).n;
  jurnal.fapta('comanda', 'comanda stearsa', { req, detalii: {
    id: order.id, nume: order.name, corpuri: cateCorpuri
  } });
  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  res.redirect('/orders');
});

/* ---------- adăugarea unui corp (aici se consumă creditul) ---------- */

router.get('/orders/:id/corp-nou', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const models = PalModels.modele(req.t).map(m => {
    const params = PalModels.paramsFor(m.id, req.t);
    return {
      id: m.id, cat: m.cat, nume: m.nume, descriere: m.descriere,
      params, rezumat: PalModels.rezumat(params, req.t), sketch: PalModels.sketch(params),
      pePodea: PalModels.staPePodea(m.id), cheiModel: PalModels.cheileModelului(m.id)
    };
  });

  res.render('corps/new', {
    title: req.t('modele.adaugaCorp'),
    categories: PalModels.categorii(req.t),
    models, order,
    sold: credit.sold(req.user.id),
    pretCorp: credit.pretCorp(),
    mesajTrimis: req.query.mesaj === '1'
  });
});

const adaugaCorp = db.transaction((userId, order, params, cost, matCorpId) => {
  const ramas = credit.scade(userId, cost, 'corp', null, 'corp.inComanda|' + order.name);
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

  const params = req.body.model
    ? PalModels.paramsFor(String(req.body.model), req.t)
    : PalCalc.defaults(req.t);
  if (!params) return next(util.eroare('eroare.modelNecunoscut', 400));

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
    const idModel = req.body.model ? '&model=' + encodeURIComponent(String(req.body.model)) : '';
    res.redirect(`/corps/${corpId}?nou=1${idModel}`);
  } catch (e) {
    if (e.message === 'CREDIT_INSUFICIENT') return res.redirect('/credit?insuficient=1');
    next(e);
  }
});

/* materialul unui corp (carcasă / fronturi) */
router.post('/corps/:id/material', requireAuth, (req, res, next) => {
  const corp = db.prepare('SELECT * FROM corps WHERE id = ?').get(Number(req.params.id));
  if (!corp || corp.user_id !== req.user.id) {
    return next(util.eroare('eroare.corpLipsa', 404));
  }

  const ale = corp.order_id ? materiale.aleComenzii(corp.order_id) : [];
  const valid = id => (id && ale.some(m => m.id === Number(id))) ? Number(id) : null;
  const matCorp = valid(req.body.mat_corp_id);
  /* „fara” nu e un material, e lipsa lui: corpul se comandă fără fronturi.
     Stă în același selector fiindcă acolo se uită omul când hotărăște din ce
     sunt ușile, iar „din nimic” e un răspuns la fel de bun ca un decor. */
  const faraFront = String(req.body.mat_front_id || '') === 'fara';
  const matFront = faraFront ? null : valid(req.body.mat_front_id);

  db.prepare("UPDATE corps SET mat_corp_id = ?, mat_front_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(matCorp, matFront, corp.id);

  /* Grosimea și cantul carcasei intră în parametrii corpului, și tot acolo
     intră semnul că fronturile nu se fac: calculul citește din params, nu
     din coloanele de material. */
  const m = matCorp ? ale.find(x => x.id === matCorp) : null;
  const params = Object.assign(PalCalc.defaults(), JSON.parse(corp.params),
    m ? { t: m.pal_mm, cg: m.cant_gros, cs: m.cant_subtire } : null,
    { faraFront: faraFront ? 1 : 0 });
  db.prepare('UPDATE corps SET params = ? WHERE id = ?').run(JSON.stringify(params), corp.id);

  res.redirect(`/corps/${corp.id}`);
});

/* Spațiul de sub scară, făcut din mai multe corpuri.

   Un corp de patru metri nu se face dintr-o bucată: nu se transportă, nu
   intră pe ușă și nu se ridică în doi oameni. Corpul deschis devine bucata
   din stânga, iar restul se adaugă în aceeași comandă, în ordine.

   Fiecare corp nou se plătește ca oricare altul — de-aia se numără întâi
   câte sunt și se cere creditul pentru toate deodată: mai bine nu se face
   niciunul decât să iasă două din patru și omul să rămână cu un perete pe
   jumătate. */
const faceSubScaraInBucati = db.transaction((user, corp, order, bucati, cost) => {
  const params = Object.assign(PalCalc.defaults(), JSON.parse(corp.params));
  const numeDeBaza = String(corp.name || 'Corp sub scară').replace(/\s*\(\d+\/\d+\)\s*$/, '');
  const n = bucati.length;

  /* bucata întâi ia locul corpului deschis: nu se plătește din nou */
  const primul = Object.assign({}, params, {
    tip: 'atipic', contur: bucati[0].contur,
    W: bucati[0].baza, H: Math.max(bucati[0].stanga, bucati[0].dreapta),
    /* dintr-o singură bucată rămâne cu numele lui, fără „(1/1)" */
    nume: n > 1 ? numeDeBaza + ' (1/' + n + ')' : numeDeBaza
  });
  db.prepare("UPDATE corps SET name = ?, params = ?, updated_at = datetime('now') WHERE id = ?")
    .run(primul.nume, JSON.stringify(primul), corp.id);

  const facute = [corp.id];
  for (let i = 1; i < n; i++) {
    const ramas = credit.scade(user.id, cost, 'corp', null, 'corp.subScara|' + numeDeBaza);
    if (ramas === null) throw new Error('CREDIT_INSUFICIENT');
    const p = Object.assign({}, params, {
      tip: 'atipic', contur: bucati[i].contur,
      W: bucati[i].baza, H: Math.max(bucati[i].stanga, bucati[i].dreapta),
      nume: numeDeBaza + ' (' + (i + 1) + '/' + n + ')'
    });
    const poz = db.prepare('SELECT COALESCE(MAX(poz), 0) AS m FROM corps WHERE order_id = ?')
                  .get(order.id).m + 1;
    const info = db.prepare(
      'INSERT INTO corps (user_id, order_id, name, params, status, poz, mat_corp_id, mat_front_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.id, order.id, p.nume, JSON.stringify(p), 'paid', poz,
          corp.mat_corp_id, corp.mat_front_id);
    const idNou = Number(info.lastInsertRowid);
    db.prepare('UPDATE credit_tx SET ref = ? WHERE id = (SELECT MAX(id) FROM credit_tx WHERE user_id = ?)')
      .run(String(idNou), user.id);
    facute.push(idNou);
  }
  return facute;
});

router.post('/corps/:id/sub-scara', requireAuth, (req, res, next) => {
  const corp = db.prepare('SELECT * FROM corps WHERE id = ?').get(Number(req.params.id));
  if (!corp || corp.user_id !== req.user.id) return next(util.eroare('eroare.corpLipsa', 404));

  const baza = Number(req.body.baza), stanga = Number(req.body.stanga), dreapta = Number(req.body.dreapta);
  const cate = Math.max(1, Math.min(PalCalc.SUB_SCARA_MAX, Math.round(Number(req.body.bucati) || 1)));
  if (!(baza >= 10 && stanga >= 10 && dreapta >= 10)) {
    return next(util.eroare('eroare.subScaraCote', 400));
  }

  const order = corp.order_id ? getOwned(corp.order_id, req.user.id) : null;
  if (cate > 1 && !order) return next(util.eroare('eroare.subScaraFaraComanda', 400));

  /* Lățimile scrise de om, pentru toate corpurile în afară de ultimul.
     Dacă nu se potrivesc (alt număr, prea înguste, nu mai rămâne pentru
     ultimul), se cade pe bucăți egale — editorul oricum nu le trimite așa. */
  const latimi = String(req.body.latimi || '').split(',').map(v => v.trim()).filter(Boolean).map(Number);
  const dinLatimi = cate > 1 && latimi.length === cate - 1
    ? PalCalc.subScaraDinLatimi(baza, dreapta, stanga, latimi) : null;
  const bucati = dinLatimi || PalCalc.subScaraInBucati(baza, dreapta, stanga, cate);
  /* Aceeași regulă ca în editor: nu se fac corpuri de 30 mm (și nu se
     plătesc), nici corpuri pe care editorul nu le-ar mai primi. */
  const problema = PalCalc.subScaraProblema(bucati);
  if (problema) return next(util.eroare('eroare.' + problema, 400));
  const cost = credit.pretCorp();
  if (cate > 1 && credit.sold(req.user.id) < cost * (cate - 1)) {
    return next(util.eroare('eroare.creditInsuficient', 402));
  }

  try {
    faceSubScaraInBucati(req.user, corp, order, bucati, cost);
  } catch (e) {
    if (String(e.message) === 'CREDIT_INSUFICIENT') {
      return next(util.eroare('eroare.creditInsuficient', 402));
    }
    throw e;
  }

  res.redirect(cate > 1 ? `/orders/${order.id}` : `/corps/${corp.id}`);
});

/* Fronturile pe toată comanda, dintr-o apăsare.

   O bucătărie se comandă fără fronturi ca bucătărie, nu corp cu corp: cine
   își cumpără ușile din altă parte — MDF vopsit, folie, sticlă — și le
   cumpără pe toate. Se poate și înapoi, cu aceeași apăsare. */
const fronturileComenzii = db.transaction((orderId, fara) => {
  const corpuri = db.prepare('SELECT id, params FROM corps WHERE order_id = ?').all(orderId);
  const scrie = db.prepare("UPDATE corps SET params = ?, updated_at = datetime('now') WHERE id = ?");
  corpuri.forEach(c => {
    const params = Object.assign(PalCalc.defaults(), JSON.parse(c.params), { faraFront: fara });
    scrie.run(JSON.stringify(params), c.id);
  });
  /* Fără fronturi, materialul de fronturi pus pe corp n-are ce tăia: se
     scoate, ca să nu pară mai târziu că s-a comandat o placă degeaba. */
  if (fara) db.prepare('UPDATE corps SET mat_front_id = NULL WHERE order_id = ?').run(orderId);
  return corpuri.length;
});

router.post('/orders/:id/fronturi', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);
  fronturileComenzii(order.id, String(req.body.fara || '') === '1' ? 1 : 0);
  res.redirect(`/orders/${order.id}`);
});

/* ---------- ansamblul: corpurile alipite în cameră ---------- */

router.get('/orders/:id/ansamblu', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cu = comandaCuCamera(order);
  const corpuri = corpuriPozitionate(order.id);
  const ans = PalAnsamblu.ansamblu(cu, corpuri, req.t);

  res.render('orders/ansamblu', {
    title: 'Ansamblu – ' + order.name,
    order: cu,
    ansamblu: ans,
    pereti: PalAnsamblu.pereti(req.t),
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
    return next(util.eroare('eroare.corpLipsa', 404));
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
  const ans = PalAnsamblu.ansamblu(cu, corpuri, req.t);

  res.json({
    camera: ans.camera,
    corpuri: ans.asezari.map(a => {
      const c = corpuri.filter(x => x.id === a.id)[0];
      const rez = PalCalc.calc(c.params, req.t);
      return {
        id: a.id, nume: a.nume,
        /* `nr` e numărul corpului din comandă, același de pe planșe și din
           codurile de piese. `perete` și `d` le citea deja panoul din vederea
           3D (public/ansamblu.js), dar nu i le trimitea nimeni, așa că scria
           mereu „peretele —, la 0 mm de colț". */
        nr: a.nr, perete: a.perete.id, d: a.poz.d,
        origine: a.origine, rotatie: a.rotatie,
        piese: rez.P.map(p => ({ nume: p.nume, boxes: p.boxes }))
      };
    })
  });
});

/* ---------- listele de producție ---------- */

const PRINTURI = {
  ansamblu: { view: 'orders/print-ansamblu', titlu: 'print.titluAnsamblu' },
  corpuri: { view: 'orders/print-corpuri', titlu: 'print.titluCorpuri' },
  debitare: { view: 'orders/print-debitare', titlu: 'print.titluDebitare' },
  incadrare: { view: 'orders/print-incadrare', titlu: 'print.titluIncadrare' },
  montaj: { view: 'orders/print-montaj', titlu: 'print.titluMontaj' },
  cnc: { view: 'orders/print-cnc', titlu: 'print.titluCnc' }
};

router.get('/orders/:id/print/:tip', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const cfg = PRINTURI[req.params.tip];
  if (!cfg) return notFound(next);

  const raport = raportComenzii(order, req.t);
  const cu = comandaCuCamera(order);
  const ans = PalAnsamblu.ansamblu(cu, corpuriPozitionate(order.id), req.t);

  res.render(cfg.view, {
    title: req.t(cfg.titlu) + ' – ' + order.name,
    titlu: req.t(cfg.titlu),
    order: cu, raport,
    ansamblu: ans,
    pereti: PalAnsamblu.pereti(req.t),
    elevatie: PalAnsamblu.elevatie,
    materiale: materiale.aleComenzii(order.id),
    planse: PalRaport.planseCnc,
    /* Fișele pe piesă ale corpurilor de sub scară: numai pe planșa CNC. */
    fiseCorpuri: req.params.tip === 'cnc'
      ? raport.corpuri.filter(c => c.params && c.params.tip === 'atipic')
          .map(c => ({ id: c.id, nume: c.nume, fise: PalFisa.fise(c.params, req.t) }))
      : [],
    planColi: PalRaport.planColi,
    coala: PalRaport.COALA,
    /* adaosul la cant rămâne intern: clientul vede metrii exacți */
    aratAdaos: !!req.user.is_admin,
    print: true
  });
});

/* ---------- export CSV pentru fabrică ---------- */

router.get('/orders/:id/export.csv', requireAuth, (req, res, next) => {
  const order = getOwned(req.params.id, req.user.id);
  if (!order) return notFound(next);

  const raport = raportComenzii(order, req.t);
  const head = ['csv.corp', 'comanda.colCod', 'csv.piesa', 'csv.buc', 'csv.taiereL', 'csv.taierel',
                'comanda.colMaterial', 'comanda.colDecor',
                'csv.cantL1', 'csv.cantL2', 'csv.cantl1', 'csv.cantl2',
                'csv.fibra', 'print.linkCnc', 'csv.nota'].map(k => req.t(k));
  const linii = [head.join(';')];

  raport.piese.forEach(p => {
    linii.push([
      p.corpNume, p.cod, p.nume, p.buc, p.TL, p.Tl,
      p.material.tip + ' ' + p.material.gros,
      p.material.decorNume || p.material.decor || '',
      p.cant.muchii[0], p.cant.muchii[1], p.cant.muchii[2], p.cant.muchii[3],
      p.fibra, p.cnc ? req.t('comun.da') : '', p.nota
    ].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';'));
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', util.dispozitieAtasament('debitare-' + order.name));
  res.send('﻿' + linii.join('\n'));
});

module.exports = { router, getOwned, corpuriComenzii, raportComenzii, GROSIMI_PAL, FORMATE_ID, adaosCant };
