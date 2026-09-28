-- Sectiunea de informatii a site-ului: ghiduri de atelier si analize de piata.
--
-- Un articol e scris INTR-O limba, nu in toate 30. Paginile din jur (meniu,
-- butoane, etichete) sunt traduse; articolul ramane in limba in care a fost
-- scris si se arata cu limba lui langa titlu. Altfel, ori se publica de 30 de
-- ori acelasi text, ori se publica o traducere pe care n-a citit-o nimeni.

CREATE TABLE IF NOT EXISTS articole (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL,                    -- bucata din adresa: /ghid/<slug>
  lang       TEXT NOT NULL,                    -- limba in care e scris
  grup       TEXT NOT NULL DEFAULT 'ghid',     -- 'ghid' | 'piata' | 'atelier'
  titlu      TEXT NOT NULL,
  rezumat    TEXT NOT NULL DEFAULT '',         -- gol = se ia din primele randuri
  corp       TEXT NOT NULL DEFAULT '',         -- text marcat, vezi shared/markdown.js
  publicat   INTEGER NOT NULL DEFAULT 0,
  autor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Acelasi slug poate exista in mai multe limbi: /ghid/cant-si-debitare in
-- romana si in engleza sunt doua randuri, cu aceeasi adresa si limbi diferite.
CREATE UNIQUE INDEX IF NOT EXISTS idx_articole_slug_lang ON articole(slug, lang);
CREATE INDEX IF NOT EXISTS idx_articole_publicate ON articole(publicat, grup, updated_at DESC);
