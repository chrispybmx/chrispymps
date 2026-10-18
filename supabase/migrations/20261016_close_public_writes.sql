-- Chiude le scritture dirette con la chiave pubblica (anon key, presente nel
-- bundle del browser) su spots, spot_photos, spot_status_updates, flags e
-- sui bucket foto. Trovate dal deep dive del 16/10/2026.
--
-- Perche' e' sicuro: nessun codice del sito scrive su queste tabelle o bucket
-- con la anon key. Tutte le scritture passano dalle API con la service role,
-- che bypassa RLS e ha gia' validazione e rate limit:
--   spots               -> app/api/submit-spot
--   spot_photos         -> app/api/submit-spot, app/api/spot-photos
--   spot_status_updates -> app/api/status-confirm
--   flags               -> app/api/flag
--   storage spot-photos -> app/api/upload-image, submit-spot, spot-photos
-- Le skill esterne (newsletter-weekly, events-scraper) non toccano queste tabelle.
--
-- Le policy di LETTURA non cambiano: il sito pubblico continua a mostrare
-- spot approvati, foto approvate e storico stati come prima.
--
-- Rollback: in fondo al file, commentato.

BEGIN;

-- 1. spot_photos: "validated photo upload" (20260428_security_fixes.sql)
--    non controllava moderation_status, che di default vale 'approved':
--    un anonimo poteva pubblicare una foto con URL qualsiasi, subito visibile.
DROP POLICY IF EXISTS "validated photo upload" ON public.spot_photos;
DROP POLICY IF EXISTS "anyone can upload photos" ON public.spot_photos;

-- 2. spot_status_updates: "anyone can report status" (schema.sql) con
--    WITH CHECK (true) non era mai stata rimossa. Le policy permissive si
--    sommano, quindi un anonimo poteva falsare lo stato di qualunque spot.
DROP POLICY IF EXISTS "anyone can report status" ON public.spot_status_updates;

--    flags: stessa forma, spam illimitato di segnalazioni.
DROP POLICY IF EXISTS "anyone can flag" ON public.flags;

-- 3. storage: upload anonimo in qualunque cartella dei bucket pubblici,
--    senza auth ne' controllo che la cartella sia uno spot reale.
DROP POLICY IF EXISTS "public upload spot photos" ON storage.objects;
DROP POLICY IF EXISTS "public upload status photos" ON storage.objects;

-- 4. spots: "anyone can submit spot" controllava solo status = 'pending'.
--    Un anonimo poteva scegliere slug, submitted_by, reviewer_notes,
--    approved_at e inondare la coda admin senza rate limit.
DROP POLICY IF EXISTS "anyone can submit spot" ON public.spots;

COMMIT;

-- Restano attive, e sono gia' vincolate a un utente autenticato:
--   spot_photos         "Users insert pending photos"   (auth.uid() = uploaded_by, pending)
--   spot_status_updates "Authenticated users insert status updates" (auth.uid() = user_id)
-- Il sito non le usa: si possono togliere in un secondo momento se non servono.

-- Verifica dopo l'applicazione (deve restituire solo policy di SELECT
-- o quelle "authenticated" elencate sopra):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE (schemaname = 'public' AND tablename IN ('spots','spot_photos','spot_status_updates','flags'))
--      OR (schemaname = 'storage' AND tablename = 'objects')
--   ORDER BY tablename, cmd;

-- ROLLBACK (solo in emergenza, riapre le falle):
-- BEGIN;
-- CREATE POLICY "anyone can submit spot" ON public.spots FOR INSERT WITH CHECK (status = 'pending');
-- CREATE POLICY "anyone can report status" ON public.spot_status_updates FOR INSERT WITH CHECK (true);
-- CREATE POLICY "anyone can flag" ON public.flags FOR INSERT WITH CHECK (true);
-- CREATE POLICY "validated photo upload" ON public.spot_photos FOR INSERT WITH CHECK (
--   EXISTS (SELECT 1 FROM public.spots WHERE id = spot_photos.spot_id AND status IN ('pending','approved'))
--   AND (SELECT count(*) FROM public.spot_photos existing WHERE existing.spot_id = spot_photos.spot_id) < 5);
-- CREATE POLICY "public upload spot photos" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'spot-photos' AND array_length(string_to_array(name, '/'), 1) = 2);
-- CREATE POLICY "public upload status photos" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'status-photos' AND array_length(string_to_array(name, '/'), 1) = 2);
-- COMMIT;
