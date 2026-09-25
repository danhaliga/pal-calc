-- Ansamblul: camera comenzii si pozitia fiecarui corp in ea.

-- camera: laturile in plan si inaltimea, ca o cutie in care se aseaza corpurile
ALTER TABLE orders ADD COLUMN camera TEXT NOT NULL DEFAULT '{"A":3200,"B":2400,"H":2500}';

-- pozitia unui corp: peretele, distanta de la coltul de start, inaltimea de la podea
ALTER TABLE corps ADD COLUMN pozitie TEXT;
