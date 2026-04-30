-- =============================================
-- PHASE 2+4+5: XP system, badges, user stats
-- Append-only point_events, materialized user_stats
-- =============================================

-- ── 1. Point events — append-only XP ledger ──
CREATE TABLE IF NOT EXISTS point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  spot_id UUID REFERENCES spots(id) ON DELETE SET NULL,
  contribution_id UUID REFERENCES spot_contributions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  xp_amount INT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  reversed_event_id UUID REFERENCES point_events(id)
);

CREATE INDEX IF NOT EXISTS idx_point_events_user ON point_events(user_id);
CREATE INDEX IF NOT EXISTS idx_point_events_type ON point_events(event_type);
CREATE INDEX IF NOT EXISTS idx_point_events_created ON point_events(created_at);

-- ── 2. User stats — denormalized for fast reads ──
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  lifetime_xp INT DEFAULT 0,
  monthly_xp INT DEFAULT 0,
  monthly_xp_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  current_level TEXT DEFAULT 'New Rider',
  trust_score INT DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  approved_spots_count INT DEFAULT 0,
  approved_photos_count INT DEFAULT 0,
  status_confirmations_count INT DEFAULT 0,
  correct_reports_count INT DEFAULT 0,
  current_streak_weeks INT DEFAULT 0,
  last_active_contribution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Badges ──
CREATE TABLE IF NOT EXISTS badges (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '🏅',
  category TEXT DEFAULT 'general',
  threshold INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_key TEXT NOT NULL REFERENCES badges(key),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ── 4. RLS Policies ──

-- point_events: users read own, NO client writes
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own point events" ON point_events;
CREATE POLICY "Users read own point events" ON point_events
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE policy = only service role can write

-- user_stats: public read (for profiles/leaderboards), no client writes
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read user stats" ON user_stats;
CREATE POLICY "Public read user stats" ON user_stats
  FOR SELECT USING (true);
-- No INSERT/UPDATE policy = only service role can write

-- badges: public read
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read badges" ON badges;
CREATE POLICY "Public read badges" ON badges
  FOR SELECT USING (true);

-- user_badges: public read
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read user badges" ON user_badges;
CREATE POLICY "Public read user badges" ON user_badges
  FOR SELECT USING (true);

-- ── 5. Seed badges ──
INSERT INTO badges (key, name, description, emoji, category, threshold) VALUES
  ('cartografo_10',     'Cartografo 10',          '10 spot approvati',                          '🗺️', 'spots',    10),
  ('cartografo_50',     'Cartografo 50',          '50 spot approvati',                          '🗺️', 'spots',    50),
  ('cartografo_100',    'Cartografo 100',         '100 spot approvati — leggenda',              '🗺️', 'spots',   100),
  ('architetto_scena',  'Architetto della Scena', 'Primo spot in una città senza spot',         '🏗️', 'pioneer',   1),
  ('scout',             'Scout',                  '50 conferme stato approvate',                 '🔭', 'status',   50),
  ('documentarista',    'Documentarista',         '25 foto approvate',                           '📸', 'photos',   25),
  ('photo_plug',        'Photo Plug',             '100 foto approvate — archivista della scena', '📷', 'photos',  100),
  ('clean_mapper',      'Clean Mapper',           '20 segnalazioni/correzioni corrette',         '🧹', 'reports',  20),
  ('og_contributor',    'OG Contributor',         'Utente beta — c''era dall''inizio',           '👑', 'special',   0),
  ('spot_savior',       'Spot Savior',            'Ha aggiornato 10 spot vecchi/danneggiati',    '🛟', 'status',   10),
  ('streak_4',          'Costante',               '4 settimane consecutive di contributi',       '🔥', 'streak',    4),
  ('streak_12',         'Infermabile',             '12 settimane consecutive — macchina',         '⚡', 'streak',   12)
ON CONFLICT (key) DO NOTHING;

-- ── 6. Function to recalculate user level from XP ──
-- Called by application code, not triggers (safer)
-- 7 levels: Rookie(0) → Local Rider(25) → Spot Hunter(75) → Local Scout(200)
--           → Verified Rider(500) → City Legend(1000) → Chrispy Scout(2500)
CREATE OR REPLACE FUNCTION calculate_level(xp INT) RETURNS TEXT AS $$
BEGIN
  IF xp >= 2500 THEN RETURN 'Chrispy Scout';
  ELSIF xp >= 1000 THEN RETURN 'City Legend';
  ELSIF xp >= 500 THEN RETURN 'Verified Rider';
  ELSIF xp >= 200 THEN RETURN 'Local Scout';
  ELSIF xp >= 75 THEN RETURN 'Spot Hunter';
  ELSIF xp >= 25 THEN RETURN 'Local Rider';
  ELSE RETURN 'Rookie';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
