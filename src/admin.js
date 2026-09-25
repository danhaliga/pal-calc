'use strict';
/* Panou de administrare: utilizatori, corpuri, plati, total incasat. */

const express = require('express');
const { db } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');

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
    totalLei: (totals.cents / 100).toFixed(2),
    totalCount: totals.n
  });
});

module.exports = { router };
