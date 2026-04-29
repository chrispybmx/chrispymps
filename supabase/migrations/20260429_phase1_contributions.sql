-- =============================================
-- PHASE 1: Contributions model + photo moderation
-- Safe migration: all ADD COLUMN use IF NOT EXISTS
-- =============================================

-- ── 1. Extend profiles ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region TEXT;

-- ── 2. Extend spot_photos for user uploads + moderation ──
ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved'
  CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT false;

-- Index for pending photo queue
CREATE INDEX IF NOT EXISTS idx_spot_photos_moderation
  ON spot_photos(moderation_status) WHERE moderation_status = 'pending';

-- ── 3. spot_contributions table ──
CREATE TABLE IF NOT EXISTS spot_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  spot_id UUID REFERENCES spots(id) ON DELETE SET NULL,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN (
    'new_spot', 'photo', 'status_confirmation',
    'location_correction', 'info_update', 'problem_report'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'needs_improvement'
  )),
  xp_awarded INT DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_user ON spot_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON spot_contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_spot ON spot_contributions(spot_id);

-- ── 4. Link spot_photos to contributions ──
ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS contribution_id UUID REFERENCES spot_contributions(id);

-- ── 5. Require auth for spot_status_updates ──
ALTER TABLE spot_status_updates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE spot_status_updates ADD COLUMN IF NOT EXISTS contribution_id UUID REFERENCES spot_contributions(id);

-- ── 6. RLS policies ──

-- spot_contributions: users read own, insert own
ALTER TABLE spot_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own contributions" ON spot_contributions;
CREATE POLICY "Users read own contributions" ON spot_contributions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own contributions" ON spot_contributions;
CREATE POLICY "Users insert own contributions" ON spot_contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Service role bypasses RLS for admin operations

-- spot_photos: allow authenticated users to insert pending photos
-- (existing RLS for max 5 photos stays — we raise to 10 for user contributions)
DROP POLICY IF EXISTS "Users insert pending photos" ON spot_photos;
CREATE POLICY "Users insert pending photos" ON spot_photos
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by
    AND moderation_status = 'pending'
    AND EXISTS (SELECT 1 FROM spots WHERE id = spot_id AND status = 'approved')
    AND (SELECT count(*) FROM spot_photos WHERE spot_id = spot_photos.spot_id) < 15
  );

-- spot_status_updates: require auth
DROP POLICY IF EXISTS "Authenticated users insert status updates" ON spot_status_updates;
CREATE POLICY "Authenticated users insert status updates" ON spot_status_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow public read of status updates
DROP POLICY IF EXISTS "Public read status updates" ON spot_status_updates;
CREATE POLICY "Public read status updates" ON spot_status_updates
  FOR SELECT USING (true);

-- Allow public read of approved photos only
DROP POLICY IF EXISTS "Public read approved photos" ON spot_photos;
CREATE POLICY "Public read approved photos" ON spot_photos
  FOR SELECT USING (moderation_status = 'approved' OR moderation_status IS NULL);

-- Users can see their own pending photos
DROP POLICY IF EXISTS "Users read own pending photos" ON spot_photos;
CREATE POLICY "Users read own pending photos" ON spot_photos
  FOR SELECT USING (auth.uid() = uploaded_by);
