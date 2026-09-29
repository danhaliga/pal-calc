-- Datele contului: cine e omul, de unde, si in ce unitate lucreaza.
--
-- Pana acum contul avea email, nume si limba. Prea putin pentru doua lucruri:
--
--   1. UNITATEA DE MASURA. Un atelier american nu taie corpuri de 720 mm, ci
--      de 34 1/2 toli. Fara sa stim tara nu putem sti in ce sa-i arat cotele,
--      si toata aplicatia e scrisa in milimetri.
--
--   2. FOAIA CARE PLEACA DIN ATELIER. Lista de debitare ajunge la cel care
--      taie palul, iar acolo trebuie sa scrie al cui e corpul si pe ce numar
--      se suna daca ceva nu se potriveste. Pana acum nu scria nimic.
--
-- Toate coloanele sunt goale sau NULL la inceput, INADINS: un cont care
-- exista deja nu se strica si nimeni nu e pus sa completeze nimic pentru a
-- intra mai departe. Se completeaza cand omul vrea, din pagina contului.

-- Tara, cod ISO 3166-1 alpha-2 ('RO', 'US'). Goala inseamna "nu ne-a spus".
ALTER TABLE users ADD COLUMN tara TEXT NOT NULL DEFAULT '';

-- NEFOLOSITA. A tinut alegerea mm / toli cat timp aplicatia a stiut sa
-- lucreze si in toli. Tolii s-au scos: costul nu era conversia, ci faptul
-- ca fiecare lucru nou de-atunci inainte ar fi trebuit gandit in doua
-- unitati de masura.
--
-- Coloana ramane, goala. Nu se sterge fiindca un DROP COLUMN pe o baza care
-- merge e o unealta ascutita scoasa pentru nimic: asa, goala, nu incurca pe
-- nimeni, iar daca se face vreodata la loc, e aici.
ALTER TABLE users ADD COLUMN unitate TEXT NOT NULL DEFAULT '';

-- Cine e, pentru capul foii de debitare.
ALTER TABLE users ADD COLUMN firma    TEXT;
ALTER TABLE users ADD COLUMN cui      TEXT;   -- cod fiscal / TVA / EIN, cum se cheama pe la ei
ALTER TABLE users ADD COLUMN telefon  TEXT;
ALTER TABLE users ADD COLUMN oras     TEXT;
ALTER TABLE users ADD COLUMN adresa   TEXT;
ALTER TABLE users ADD COLUMN site     TEXT;

-- Ce face: 'atelier', 'tamplar', 'designer', 'magazin', 'amator'.
-- Nu e o intrebare de sondaj: de la ea pleaca mai tarziu catalogul de modele
-- care se arata primul, si e singurul fel in care se poate vedea cine
-- foloseste aplicatia.
ALTER TABLE users ADD COLUMN profil TEXT NOT NULL DEFAULT '';

-- Cautarea dupa tara si profil: doua rapoarte scurte in panoul de
-- administrare, pe un tabel care va avea multe randuri.
CREATE INDEX IF NOT EXISTS idx_users_tara ON users(tara);
