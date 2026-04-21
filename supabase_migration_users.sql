-- ================================================================
-- CHRISPY MAPS — Migration: user profiles + spot attribution
-- Esegui in Supabase → SQL Editor → New query
--
-- PRIMA di eseguire:
-- 1. Vai su Authentication → Settings
-- 2. Disabilita "Email Confirmations" (così gli utenti entrano subito)
-- ================================================================

-- ── PROFILES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username    text UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 30 AND username ~ '^[a-zA-Z0-9_]+$'),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chiunque può leggere i profili pubblici
CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (true);

-- Ogni utente può inserire solo il proprio profilo
CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Ogni utente può aggiornare solo il proprio
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── SPOTS: aggiungi colonne utente ──────────────────────────────
ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS submitted_by_user_id  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_by_username text;

-- Indice per query per username (pagina profilo)
CREATE INDEX IF NOT EXISTS spots_username_idx ON spots (submitted_by_username);

-- ── AGGIORNA RLS spots: tutti possono leggere gli approvati ─────
-- (Se già esiste la policy, puoi saltare)
-- DROP POLICY IF EXISTS "spots_public_read" ON spots;
-- CREATE POLICY "spots_public_read" ON spots
--   FOR SELECT USING (status = 'approved');

-- Done ✅
-- Ricorda di disabilitare "Email Confirmations" in Auth → Settings → Email!
