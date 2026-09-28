-- Casuta de mesaje. Panoul "ce nu poate inca genera calculul" ii spunea
-- omului sa zica ce-i lipseste, dar n-avea unde s-o scrie.

CREATE TABLE IF NOT EXISTS mesaje (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pagina     TEXT NOT NULL DEFAULT '',   -- de unde a scris, ca sa stim la ce se uita
  text       TEXT NOT NULL,
  vazut      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mesaje_noi ON mesaje(vazut, created_at DESC);
