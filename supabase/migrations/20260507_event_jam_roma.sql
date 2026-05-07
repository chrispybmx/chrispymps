-- =============================================
-- Event system tables for Jam Roma (and future events)
-- =============================================

-- RSVP: "Io vengo" / "Forse"
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_slug, user_id)
);

-- Live presence: rider sulla mappa durante l'evento
CREATE TABLE IF NOT EXISTS event_live_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sharing_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_slug, user_id)
);

-- Spot ufficiali dell'evento
CREATE TABLE IF NOT EXISTS event_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug TEXT NOT NULL,
  spot_id UUID REFERENCES spots(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  label TEXT,
  meeting_point BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_slug, spot_id)
);

-- RLS
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_live_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_spots ENABLE ROW LEVEL SECURITY;

-- Read policies
DROP POLICY IF EXISTS "public read event rsvps" ON event_rsvps;
CREATE POLICY "public read event rsvps"
  ON event_rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read live presence" ON event_live_presence;
CREATE POLICY "public read live presence"
  ON event_live_presence FOR SELECT USING (
    sharing_enabled = true
    AND last_seen_at > now() - interval '5 minutes'
  );

DROP POLICY IF EXISTS "public read event spots" ON event_spots;
CREATE POLICY "public read event spots"
  ON event_spots FOR SELECT USING (true);

-- Indici
CREATE INDEX IF NOT EXISTS idx_event_rsvps_slug ON event_rsvps(event_slug);
CREATE INDEX IF NOT EXISTS idx_event_presence_slug ON event_live_presence(event_slug, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_event_spots_slug ON event_spots(event_slug);
