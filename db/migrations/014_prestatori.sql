-- Prestatorii de servicii (debitare, cant, CNC) si comenzile trimise la ei.
--
-- Atelierul face proiectul in aplicatie, apoi il trimite pe email la un
-- prestator (HTC Cubbis in Iasi, de exemplu): arhiva cu planșele si
-- debitarea in Excel, atasata. Lista prestatorilor o tine administratorul;
-- atelierul doar alege din ea. Asa aplicatia nu poate fi folosita ca sa
-- trimita emailuri la orice adresa.

CREATE TABLE IF NOT EXISTS prestatori (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nume       TEXT NOT NULL,
  oras       TEXT,
  email      TEXT NOT NULL,
  telefon    TEXT,
  servicii   TEXT,                       -- „debitare, cant, CNC" — scris liber
  nota       TEXT,                       -- ce vrea prestatorul sa primeasca, limite de placa...
  activ      INTEGER NOT NULL DEFAULT 1, -- 0 = nu mai apare in lista atelierelor
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fiecare trimitere, reusita sau nu. Datele prestatorului se copiaza: daca
-- mai tarziu se schimba adresa lui, istoricul spune unde a plecat atunci.
CREATE TABLE IF NOT EXISTS trimiteri (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prestator_id  INTEGER REFERENCES prestatori(id) ON DELETE SET NULL,
  prestator     TEXT NOT NULL,
  catre         TEXT NOT NULL,
  subiect       TEXT NOT NULL,
  stare         TEXT NOT NULL,           -- 'trimis' | 'eroare'
  eroare        TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trimiteri_order ON trimiteri(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trimiteri_user ON trimiteri(user_id, created_at);
