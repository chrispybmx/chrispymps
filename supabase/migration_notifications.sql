-- ─────────────────────────────────────────────────────────
-- Migration: sistema notifiche in-app
-- Eseguire in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('spot_approved', 'spot_rejected', 'comment_on_spot')),
  title      text        NOT NULL,
  body       text        NOT NULL,
  spot_slug  text,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indice per query principale (utente → ultime notifiche)
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- Indice per contare le non lette rapidamente
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, read) WHERE read = false;

-- Row Level Security — gli utenti vedono solo le proprie notifiche
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Il service role bypassa RLS automaticamente in Supabase,
-- quindi non serve una policy INSERT separata per il backend.
