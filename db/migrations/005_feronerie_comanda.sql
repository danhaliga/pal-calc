-- Sistemul de feronerie se alege la deschiderea comenzii, inainte de corpuri:
-- de el depind si cantitatile, si programul de gaurire.

ALTER TABLE orders ADD COLUMN feronerie TEXT NOT NULL
  DEFAULT '{"asamblare":"minifix","balama":"blum-clip","glisiere":"bila","suspensii":true}';
