-- Origine della foto di uno spot.
--
-- Perché: al 19/08/2026 una parte delle copertine sono fermi immagine di Google
-- Street View (passanti sfocati, auto parcheggiate, luce piatta di mezzogiorno).
-- Doppio problema:
--   1. emotivo — una foto Street View dice "questo posto l'ho trovato su
--      internet", una foto vera dice "io ci sono stato";
--   2. legale — sono immagini di terzi ripubblicate, con un credito che indica
--      un utente della community.
-- Marcandole possiamo etichettarle in UI ("foto da mappa — serve uno scatto
-- vero"), tenerle fuori dai primi risultati di /scopri, e trasformarle in una
-- micro-quest da +8 XP (PHOTO_UPDATE_OLD esiste già in lib/xp.ts).
--
-- NB: `ADD COLUMN IF NOT EXISTS` è sicuro qui perché non aggiunge vincoli di
-- foreign key (vedi tasks/lessons.md, 2026-07-22: con IF NOT EXISTS Postgres
-- salta l'INTERA clausola, REFERENCES compreso, se la colonna esiste già).

ALTER TABLE spot_photos
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rider';

-- Vincolo separato dalla ADD COLUMN, così è idempotente e verificabile.
ALTER TABLE spot_photos DROP CONSTRAINT IF EXISTS spot_photos_source_check;
ALTER TABLE spot_photos
  ADD CONSTRAINT spot_photos_source_check
  CHECK (source IN ('rider', 'streetview'));

CREATE INDEX IF NOT EXISTS idx_spot_photos_source
  ON spot_photos(source) WHERE source <> 'rider';

COMMENT ON COLUMN spot_photos.source IS
  'rider = scatto di un rider sul posto; streetview = fermo immagine da mappa, da sostituire';

-- ─────────────────────────────────────────────────────────────────────────────
-- MARCATURA — da eseguire a mano, non automatizzabile.
--
-- Non esiste un modo affidabile di riconoscere uno screenshot di Street View
-- dall'URL o dai metadati: va deciso guardando le foto. Elenca i candidati con
-- la query qui sotto, poi marca gli id che riconosci.
--
--   SELECT p.id, s.name, s.city, p.url
--     FROM spot_photos p
--     JOIN spots s ON s.id = p.spot_id
--    WHERE p.position = 0
--    ORDER BY s.city, s.name;
--
--   UPDATE spot_photos SET source = 'streetview'
--    WHERE id IN ('<id>', '<id>', ...);
-- ─────────────────────────────────────────────────────────────────────────────
