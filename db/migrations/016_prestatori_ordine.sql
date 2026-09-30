-- Ordinea prestatorilor: Dan vrea HTC Cubbis primul. Cu cât `ordine` e mai
-- mare, cu atât firma stă mai sus; la egalitate, recomandații întâi, apoi
-- după nume. Se schimbă din Administrare → Prestatori.
ALTER TABLE prestatori ADD COLUMN ordine INTEGER NOT NULL DEFAULT 0;
UPDATE prestatori SET ordine = 100 WHERE nume = 'HTC Cubbis';
