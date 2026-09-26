'use strict';
/* CSRF simplu, cu token in sesiune.
   - formularele trimit campul ascuns _csrf
   - cererile fetch (JSON) trimit antetul x-csrf-token
   Cererile GET/HEAD/OPTIONS si webhook-ul Stripe (semnat separat) sunt exceptate. */

const crypto = require('crypto');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT = [/^\/webhooks\//];

function token(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}

function middleware(req, res, next) {
  res.locals.csrfToken = token(req);

  if (SAFE.has(req.method) || EXEMPT.some(rx => rx.test(req.path))) return next();

  const sent = (req.body && req.body._csrf) ||
               req.get('x-csrf-token') ||
               req.get('x-xsrf-token');

  const expected = req.session.csrf;
  const ok = typeof sent === 'string' &&
             sent.length === expected.length &&
             crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));

  if (!ok) {
    const err = require('./util').eroare('eroare.csrf', 403);
    err.status = 403;
    return next(err);
  }
  next();
}

module.exports = { middleware, token };
