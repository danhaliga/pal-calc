-- Setarile aplicatiei care se schimba din panoul de administrare.
--
-- Pana acum tot ce tinea de plata statea in .env, pe server. Ca sa pui
-- cheile Stripe trebuia sa intri pe server si sa editezi un fisier — adica
-- exact lucrul pe care cel care conduce atelierul nu-l face. Acum le pune
-- din contul de administrator, iar .env ramane doar rezerva: ce e scris
-- aici bate ce e scris acolo.
--
-- Valorile secrete (cheile Stripe) se scriu CRIPTATE: o copie a bazei de
-- date luata pentru o proba sau uitata pe un disc nu trebuie sa fie si
-- cheia contului de bani. Vezi src/setari.js.

CREATE TABLE IF NOT EXISTS setari (
  cheie      TEXT PRIMARY KEY,           -- numele din .env: 'STRIPE_SECRET_KEY', ...
  valoare    TEXT NOT NULL,              -- criptata, pentru cele secrete
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Cine a schimbat-o. Fara cheie straina, ca la jurnal: setarea ramane si
  -- dupa ce contul se sterge.
  updated_by INTEGER
);
