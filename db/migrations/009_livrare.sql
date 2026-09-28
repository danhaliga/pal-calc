-- Data livrarii si telefonul de contact al comenzii.
--
-- Data se tine ca text ISO (AAAA-LL-ZZ), ca restul datelor din baza: asa se
-- compara si se sorteaza corect fara sa stim fusul orar al nimanui.
-- Goale amandoua inseamna "nu s-a stabilit inca", nu "azi" sau "fara".

ALTER TABLE orders ADD COLUMN livrare_la TEXT;
ALTER TABLE orders ADD COLUMN telefon TEXT;
