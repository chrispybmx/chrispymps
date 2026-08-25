-- Rimuove la policy che rendeva pubbliche anche le foto non moderate.
--
-- ESEGUITA in produzione il 2026-08-23 (SQL Editor, progetto chrispymps).
-- Stato prima:  3 policy SELECT, inclusa quella larga qui sotto.
-- Stato dopo:   2 policy SELECT — "Public read approved photos" e
--               "Users read own pending photos". Verificato con la query in
--               fondo a questo file.
-- Al momento dell'esecuzione: 242 foto, tutte 'approved', nessuna 'pending'.
-- Quindi nessuna foto era davvero esposta — la porta era aperta ma non ci era
-- ancora passato nessuno. Letture verificate dopo il cambio: 118 spot, 118 con
-- copertina, schede spot con tutte le foto.
--
-- Il problema
-- -----------
-- In schema.sql (riga 102) vive dal primo giorno:
--
--   create policy "public read photos of approved spots" on spot_photos
--     for select using (
--       exists (select 1 from spots
--                where spots.id = spot_photos.spot_id
--                  and spots.status = 'approved')
--     );
--
-- Non guarda `moderation_status`. La moderazione delle foto e' arrivata dopo,
-- con 20260429_phase1_contributions.sql, che ha aggiunto la policy giusta:
--
--   create policy "Public read approved photos" on spot_photos
--     for select using (moderation_status = 'approved' or moderation_status is null);
--
-- ma NON ha rimosso quella vecchia. In Postgres due policy permissive sulla
-- stessa operazione si sommano in OR: basta che una passi. Quindi la seconda
-- non restringe niente e ogni foto caricata da chiunque e' leggibile in
-- pubblico prima che l'admin la veda.
--
-- Il codice applicativo ora filtra comunque (app/api/spots/route.ts e
-- app/map/spot/[slug]/page.tsx), quindi il sito non le mostra piu'. Ma il
-- filtro applicativo protegge le nostre pagine, non la tabella: chiunque
-- abbia la chiave anon — che sta nel bundle, come da progetto — puo'
-- interrogare spot_photos direttamente e leggerle lo stesso.
--
-- Verifica prima di eseguire
-- --------------------------
--   select policyname, qual
--     from pg_policies
--    where tablename = 'spot_photos' and cmd = 'SELECT';
--
-- Attese DOPO questa migration: "Public read approved photos" e
-- "Users read own pending photos". Se compare ancora la vecchia, non e'
-- stata eseguita.

DROP POLICY IF EXISTS "public read photos of approved spots" ON spot_photos;

-- Ricreata per idempotenza: se per qualsiasi motivo mancasse, questa e' la
-- sola policy di lettura pubblica che deve esistere.
DROP POLICY IF EXISTS "Public read approved photos" ON spot_photos;
CREATE POLICY "Public read approved photos" ON spot_photos
  FOR SELECT USING (moderation_status = 'approved' OR moderation_status IS NULL);
