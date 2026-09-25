-- Schema initiala: utilizatori, corpuri, plati.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS corps (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  params     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft',
  paid_at    TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corps_user ON corps(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  corp_id       INTEGER NOT NULL REFERENCES corps(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ron',
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL;
