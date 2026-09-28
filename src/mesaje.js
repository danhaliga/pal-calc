'use strict';
/* Căsuța de mesaje.

   Panoul „ce nu poate încă genera calculul" se termina cu „spune-mi care —
   se pot adăuga în motorul de calcul", și n-avea nicio căsuță. Acum are. */

const express = require('express');
const { z } = require('zod');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const util = require('./util');

const router = express.Router();

const schema = z.object({
  text: z.string().trim().min(3).max(2000),
  pagina: z.string().trim().max(200).catch('')
});

/* `inapoi` vine din formular, deci din mâna omului. Un „//alt-site.ro" ar
   trimite utilizatorul afară din aplicație cu un redirect al nostru, așa că
   primim doar drumuri locale: un singur „/" la început și nimic după el
   care să înceapă altă gazdă. */
function inapoiSigur(brut) {
  const s = String(brut || '');
  return /^\/[^/\\]/.test(s) ? s : '/corps/new';
}

router.post('/mesaje', requireAuth, (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return next(util.eroare('mesaj.preaScurt', 400));

  db.prepare('INSERT INTO mesaje (user_id, pagina, text) VALUES (?, ?, ?)')
    .run(req.user.id, parsed.data.pagina, parsed.data.text);

  const unde = inapoiSigur(req.body.inapoi);
  res.redirect(unde + (unde.indexOf('?') === -1 ? '?' : '&') + 'mesaj=1');
});

/* Pentru panoul de administrare. */
function ultimele(n) {
  return db.prepare(`
    SELECT m.id, m.pagina, m.text, m.vazut, m.created_at, u.email
    FROM mesaje m JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC, m.id DESC LIMIT ?
  `).all(n || 100);
}

function cateNoi() {
  return db.prepare('SELECT COUNT(*) AS n FROM mesaje WHERE vazut = 0').get().n;
}

module.exports = { router, ultimele, cateNoi };
