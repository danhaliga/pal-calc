-- Limba aleasa de utilizator. Goala inseamna "ce zice browserul".

ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT '';
