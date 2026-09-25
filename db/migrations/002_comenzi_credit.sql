-- Credit in cont, comenzi si legatura corpurilor de comanda.

-- ---------- credit ----------
ALTER TABLE users ADD COLUMN credit_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_tx (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta_cents   INTEGER NOT NULL,          -- pozitiv la alimentare, negativ la consum
  balance_after INTEGER NOT NULL,
  kind          TEXT NOT NULL,             -- 'topup' | 'corp' | 'refund' | 'ajustare'
  ref           TEXT,                      -- id plata sau id corp
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_user ON credit_tx(user_id, created_at DESC);

-- ---------- comenzi ----------
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL DEFAULT 'egger',      -- 'egger' | 'kronospan'
  decor       TEXT,                                -- codul/culoarea PAL-ului
  cant_decor  TEXT,                                -- culoarea cantului
  pal_mm      REAL NOT NULL DEFAULT 18,
  cant_gros   REAL NOT NULL DEFAULT 2,             -- 0.4 | 0.8 | 1 | 2
  cant_subtire REAL NOT NULL DEFAULT 0.4,
  adaos_cant  REAL NOT NULL DEFAULT 15,            -- procent adaugat la metrii de cant
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

-- ---------- corpurile apartin unei comenzi ----------
ALTER TABLE corps ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE corps ADD COLUMN poz INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_corps_order ON corps(order_id, poz);

-- ---------- plati: si alimentari de credit, nu doar corpuri ----------
CREATE TABLE payments_nou (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  corp_id       INTEGER REFERENCES corps(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL DEFAULT 'corp',      -- 'corp' | 'topup'
  provider      TEXT NOT NULL,
  provider_ref  TEXT,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ron',
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payments_nou (id, user_id, corp_id, kind, provider, provider_ref,
                          amount_cents, currency, status, created_at, updated_at)
  SELECT id, user_id, corp_id, 'corp', provider, provider_ref,
         amount_cents, currency, status, created_at, updated_at
  FROM payments;

DROP TABLE payments;
ALTER TABLE payments_nou RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL;
