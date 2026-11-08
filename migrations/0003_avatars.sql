-- Foto profilo: una sola per persona, piccola (circa 10 KB), salvata a parte
-- così le liste di persone e film restano leggere.
-- people.avatar_v = versione (NULL = nessuna foto): serve a far ricaricare la foto quando cambia.
ALTER TABLE people ADD COLUMN avatar_v INTEGER;
CREATE TABLE avatars (
  person_id INTEGER PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  data      TEXT NOT NULL  -- JPEG in base64
);
