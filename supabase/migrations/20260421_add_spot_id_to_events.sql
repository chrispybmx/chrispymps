-- Migration: aggiungi spot_id alla tabella events
-- Esegui questo SQL nel SQL Editor di Supabase (https://supabase.com/dashboard → SQL Editor)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS spot_id UUID REFERENCES spots(id) ON DELETE SET NULL;

-- Index opzionale per query veloci
CREATE INDEX IF NOT EXISTS idx_events_spot_id ON events(spot_id);
