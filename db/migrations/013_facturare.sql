-- Datele de facturare ale clientului si exportul platilor spre programul de
-- facturare al lui Dan (care face facturile si le trimite in SPV).
--
-- In cont existau deja numele, firma, CUI-ul, adresa, orasul si telefonul
-- (pentru capul foii de debitare). Pentru factura mai trebuie: ce fel de
-- client e (persoana fizica / firma), numarul de la Registrul Comertului si
-- judetul.

ALTER TABLE users ADD COLUMN tip_facturare TEXT NOT NULL DEFAULT '';   -- 'pf' | 'pj' | ''
ALTER TABLE users ADD COLUMN reg_com       TEXT;
ALTER TABLE users ADD COLUMN judet         TEXT;

-- Pe plata se copiaza datele de facturare din clipa platii (JSON). Factura
-- iese cu ce era atunci, nu cu ce si-a pus omul in cont luna urmatoare.
ALTER TABLE payments ADD COLUMN facturare   TEXT;
-- Cand a fost scoasa in export: ca aceeasi plata sa nu fie facturata de
-- doua ori. NULL = inca neexportata.
ALTER TABLE payments ADD COLUMN exportat_la TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_export ON payments(status, exportat_la, created_at);
