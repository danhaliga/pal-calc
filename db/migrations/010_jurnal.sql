-- Jurnalul aplicatiei: erorile si faptele care merita tinute minte.
--
-- Pana acum erorile se duceau in `console.error`. Pe un server adevarat
-- asta inseamna un jurnal care se deruleaza si se pierde: pana te uiti tu,
-- randul cu pricina a plecat de mult. Aici raman.
--
-- Doua feluri de randuri, in acelasi tabel, ca sa se poata citi in ordine
-- unele langa altele — de multe ori fapta de dinaintea erorii spune de ce
-- s-a intamplat:
--   'eroare'  ceva s-a rupt
--   'atentie' ceva ciudat, dar nu rupt (autentificare gresita, plata refuzata)
--   'fapta'   ceva ce a facut cineva (a intrat in cont, a facut o comanda)

CREATE TABLE IF NOT EXISTS jurnal (
  id         INTEGER PRIMARY KEY,
  nivel      TEXT NOT NULL,
  sursa      TEXT NOT NULL,             -- 'http', 'cont', 'plata', 'comanda', ...
  mesaj      TEXT NOT NULL,
  detalii    TEXT,                      -- JSON; niciodata parole sau chei

  -- Cine. Numar, nu email, si INADINS fara cheie straina: randul ramane si
  -- dupa ce contul se sterge, dar atunci nu mai e legat de nicio persoana.
  user_id    INTEGER,

  ruta       TEXT,
  metoda     TEXT,
  status     INTEGER,

  -- Adresa, trunchiata la primele trei numere (ex. 93.119.153.0). Ajunge ca
  -- sa vezi ca zece incercari de autentificare vin din acelasi loc, si nu
  -- ajunge ca sa spui cine e omul.
  ip         TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jurnal_cand ON jurnal(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_jurnal_nivel ON jurnal(nivel, created_at DESC);
