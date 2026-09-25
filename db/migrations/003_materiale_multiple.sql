-- Mai multe materiale (decoruri) pe comanda, fiecare cu cantul lui.

CREATE TABLE IF NOT EXISTS order_materials (
  id              INTEGER PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  poz             INTEGER NOT NULL DEFAULT 1,
  nume            TEXT NOT NULL,                      -- eticheta din comanda
  rol             TEXT NOT NULL DEFAULT 'corp',       -- 'corp' | 'front' | 'spate' | 'sertar'
  brand           TEXT NOT NULL DEFAULT 'Egger',
  decor_cod       TEXT,
  decor_nume      TEXT,
  hex             TEXT,
  pal_mm          REAL NOT NULL DEFAULT 18,
  cant_gros       REAL NOT NULL DEFAULT 2,
  cant_subtire    REAL NOT NULL DEFAULT 0.4,
  cant_decor_cod  TEXT,                               -- cantul poate fi alt decor decat placa
  cant_decor_nume TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ordmat_order ON order_materials(order_id, poz);

-- corpul spune din ce material e carcasa si din ce sunt fronturile
ALTER TABLE corps ADD COLUMN mat_corp_id INTEGER REFERENCES order_materials(id) ON DELETE SET NULL;
ALTER TABLE corps ADD COLUMN mat_front_id INTEGER REFERENCES order_materials(id) ON DELETE SET NULL;

-- formatele de coala permise la croire (JSON): intreaga, jumatate, sfert
ALTER TABLE orders ADD COLUMN formate TEXT NOT NULL DEFAULT '["intreaga","jum-lat","jum-lung","sfert"]';

-- comenzile existente primesc un material construit din campurile lor de pana acum
INSERT INTO order_materials (order_id, poz, nume, rol, brand, decor_cod, decor_nume,
                             pal_mm, cant_gros, cant_subtire, cant_decor_nume)
  SELECT id, 1,
         COALESCE(NULLIF(decor, ''), 'Material comandă'),
         'corp',
         CASE LOWER(brand) WHEN 'kronospan' THEN 'Kronospan' ELSE 'Egger' END,
         NULL,
         decor,
         pal_mm, cant_gros, cant_subtire, cant_decor
  FROM orders;

UPDATE corps
   SET mat_corp_id = (SELECT m.id FROM order_materials m WHERE m.order_id = corps.order_id ORDER BY m.poz LIMIT 1)
 WHERE order_id IS NOT NULL;
