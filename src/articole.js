'use strict';
/* Secțiunea de informații a site-ului.

   Un articol e scris într-o limbă, nu în toate 30. Lista le arată întâi pe
   cele din limba paginii, apoi restul, fiecare cu limba lui lângă titlu. Nu
   traducem singuri: o traducere pe care n-a citit-o nimeni e mai rea decât
   un articol cinstit într-o limbă străină. */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const util = require('./util');
const Markdown = require('../shared/markdown');
const { faSlug } = require('../shared/slug');
const I18n = require('../shared/i18n');

const router = express.Router();

const GRUPURI = ['ghid', 'piata', 'atelier'];

const schema = z.object({
  titlu: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(80).optional().or(z.literal('')),
  lang: z.string().trim().length(2),
  grup: z.enum(GRUPURI).catch('ghid'),
  rezumat: z.string().trim().max(400).optional().or(z.literal('')),
  corp: z.string().max(60000).optional().or(z.literal('')),
  publicat: z.coerce.boolean().catch(false)
});

/* Slugul trebuie să fie unic pe limbă. Dacă e luat, îi punem un număr în
   coadă, în loc să refuzăm salvarea și să-l punem pe om să ghicească. */
function slugLiber(slug, lang, afaraDe) {
  const exista = id => db.prepare(
    'SELECT 1 FROM articole WHERE slug = ? AND lang = ?' + (afaraDe ? ' AND id <> ?' : '')
  ).get(...(afaraDe ? [id, lang, afaraDe] : [id, lang]));

  let candidat = slug;
  for (let n = 2; exista(candidat) && n < 200; n++) candidat = slug + '-' + n;
  return candidat;
}

function pregateste(rand, t) {
  return Object.assign({}, rand, {
    html: Markdown.randeaza(rand.corp),
    rezumatText: rand.rezumat || Markdown.rezumat(rand.corp, 180),
    numeGrup: t ? t('articole.grup' + rand.grup.charAt(0).toUpperCase() + rand.grup.slice(1)) : rand.grup,
    numeLimba: (I18n.LIMBI.find(l => l.cod === rand.lang) || {}).nume || rand.lang
  });
}

/* ---------- paginile publice ---------- */

router.get('/ghid', (req, res) => {
  const grup = GRUPURI.indexOf(String(req.query.grup || '')) !== -1 ? String(req.query.grup) : null;

  const randuri = db.prepare(`
    SELECT * FROM articole
    WHERE publicat = 1 ${grup ? 'AND grup = ?' : ''}
    ORDER BY (lang = ?) DESC, updated_at DESC, id DESC
  `).all(...(grup ? [grup, req.lang] : [req.lang]));

  res.render('articole/index', {
    title: req.t('articole.titlu'),
    articole: randuri.map(r => pregateste(r, req.t)),
    grupuri: GRUPURI.map(g => ({
      id: g, nume: req.t('articole.grup' + g.charAt(0).toUpperCase() + g.slice(1))
    })),
    grupAles: grup
  });
});

router.get('/ghid/:slug', (req, res, next) => {
  /* Dacă articolul există și în limba paginii, ăla se arată; altfel oricare. */
  const a = db.prepare(`
    SELECT * FROM articole WHERE slug = ? AND publicat = 1
    ORDER BY (lang = ?) DESC, updated_at DESC LIMIT 1
  `).get(req.params.slug, req.lang);
  if (!a) return next(util.eroare('articole.lipsa', 404));

  /* Aceeași poveste în alte limbi, dacă a mai scris-o cineva. */
  const alteLimbi = db.prepare(
    'SELECT lang FROM articole WHERE slug = ? AND publicat = 1 AND lang <> ?'
  ).all(a.slug, a.lang).map(r => ({
    cod: r.lang, nume: (I18n.LIMBI.find(l => l.cod === r.lang) || {}).nume || r.lang
  }));

  res.render('articole/articol', {
    title: a.titlu,
    articol: pregateste(a, req.t),
    alteLimbi
  });
});

/* ---------- administrare ---------- */

router.get('/admin/articole', requireAuth, requireAdmin, (req, res) => {
  const randuri = db.prepare('SELECT * FROM articole ORDER BY updated_at DESC, id DESC').all();
  res.render('admin/articole', {
    title: req.t('articole.administrare'),
    articole: randuri.map(r => pregateste(r, req.t))
  });
});

router.get('/admin/articole/nou', requireAuth, requireAdmin, (req, res) => {
  res.render('admin/articol-edit', {
    title: req.t('articole.nou'),
    articol: { id: null, titlu: '', slug: '', lang: req.lang, grup: 'ghid',
               rezumat: '', corp: '', publicat: 0 },
    grupuri: GRUPURI,
    limbi: I18n.LIMBI,
    salvat: false
  });
});

router.get('/admin/articole/:id', requireAuth, requireAdmin, (req, res, next) => {
  const a = db.prepare('SELECT * FROM articole WHERE id = ?').get(Number(req.params.id));
  if (!a) return next(util.eroare('articole.lipsa', 404));
  res.render('admin/articol-edit', {
    title: a.titlu, articol: a, grupuri: GRUPURI, limbi: I18n.LIMBI,
    salvat: req.query.salvat === '1'
  });
});

router.post('/admin/articole', requireAuth, requireAdmin, (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return next(util.eroare('articole.dateRele', 400));
  const d = parsed.data;

  const slug = slugLiber(faSlug(d.slug || d.titlu) || 'articol', d.lang, null);
  const info = db.prepare(`
    INSERT INTO articole (slug, lang, grup, titlu, rezumat, corp, publicat, autor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(slug, d.lang, d.grup, d.titlu, d.rezumat || '', d.corp || '',
         d.publicat ? 1 : 0, req.user.id);

  res.redirect('/admin/articole/' + Number(info.lastInsertRowid) + '?salvat=1');
});

router.post('/admin/articole/:id', requireAuth, requireAdmin, (req, res, next) => {
  const a = db.prepare('SELECT * FROM articole WHERE id = ?').get(Number(req.params.id));
  if (!a) return next(util.eroare('articole.lipsa', 404));

  if (req.body.sterge === '1') {
    db.prepare('DELETE FROM articole WHERE id = ?').run(a.id);
    return res.redirect('/admin/articole');
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return next(util.eroare('articole.dateRele', 400));
  const d = parsed.data;

  const slug = slugLiber(faSlug(d.slug || d.titlu) || 'articol', d.lang, a.id);
  db.prepare(`
    UPDATE articole SET slug = ?, lang = ?, grup = ?, titlu = ?, rezumat = ?, corp = ?,
           publicat = ?, updated_at = datetime('now')
     WHERE id = ?
  `).run(slug, d.lang, d.grup, d.titlu, d.rezumat || '', d.corp || '',
         d.publicat ? 1 : 0, a.id);

  res.redirect('/admin/articole/' + a.id + '?salvat=1');
});

module.exports = { router, GRUPURI };
