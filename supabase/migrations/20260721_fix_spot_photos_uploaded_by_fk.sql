-- FIX: upload foto su spot esistenti sempre fallito (500 "Errore durante il caricamento")
--
-- Causa: spot_photos.uploaded_by aveva una FK verso la tabella legacy `contributors`.
-- La migration 20260429_phase1_contributions.sql usava
--   ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
-- ma la colonna ESISTEVA GIÀ: con IF NOT EXISTS Postgres salta l'intera clausola,
-- quindi il REFERENCES auth.users non è mai stato applicato e la vecchia FK è rimasta.
-- Risultato: /api/spot-photos inserisce uploaded_by = auth.users.id → violazione FK
-- (23503: "Key (uploaded_by)=... is not present in table contributors") → insert nullo
-- → uploadedUrls vuoto → 500 al client. Verificato in produzione: 0 foto con
-- uploaded_by valorizzato, 0 foto pending, 4 contributi orfani da tentativi falliti.
--
-- Nessun dato da migrare: la colonna è NULL su tutte le 211 foto esistenti.

ALTER TABLE spot_photos DROP CONSTRAINT IF EXISTS spot_photos_uploaded_by_fkey;

ALTER TABLE spot_photos
  ADD CONSTRAINT spot_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- NB: i 4 contributi orfani lasciati dai tentativi falliti si ripuliscono a parte,
-- vedi 20260721_cleanup_orphan_photo_contributions.sql (da eseguire solo su conferma).
