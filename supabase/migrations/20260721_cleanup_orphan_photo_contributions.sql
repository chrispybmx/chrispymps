-- OPZIONALE / DISTRUTTIVO — eseguire solo dopo conferma esplicita.
--
-- Rimuove i contributi di tipo 'photo' rimasti 'pending' senza nessuna foto
-- collegata: sono i tentativi di upload falliti per il bug della FK
-- (vedi 20260721_fix_spot_photos_uploaded_by_fk.sql). Al 21/07/2026 sono 4.
-- Senza pulizia restano per sempre nella coda di moderazione come voci fantasma.
--
-- Prima di cancellare, guardarli:
--   SELECT id, spot_id, user_id, created_at FROM spot_contributions sc
--   WHERE sc.contribution_type = 'photo' AND sc.status = 'pending'
--     AND NOT EXISTS (SELECT 1 FROM spot_photos sp WHERE sp.contribution_id = sc.id);

DELETE FROM spot_contributions sc
WHERE sc.contribution_type = 'photo'
  AND sc.status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM spot_photos sp WHERE sp.contribution_id = sc.id);
