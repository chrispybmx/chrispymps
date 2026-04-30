-- =============================================
-- PHASE 3: Community events + news + news comments
-- Users can submit events/news → pending → admin approve
-- Comments on news articles (reuse comments pattern)
-- =============================================

-- ── 1. Extend events for user submissions ──
ALTER TABLE events ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS submitted_by_username TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'published'
  CHECK (moderation_status IN ('pending', 'published', 'rejected'));

-- ── 2. Extend news for user submissions ──
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES auth.users(id);
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_by_username TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'published'
  CHECK (moderation_status IN ('pending', 'published', 'rejected'));
-- Allow longer body text for user blog posts
-- (existing constraint may be 10000, we raise to 50000)

-- ── 3. Extend comments to support news articles ──
ALTER TABLE comments ADD COLUMN IF NOT EXISTS news_id UUID REFERENCES news(id) ON DELETE CASCADE;
-- Now a comment can be on a spot (spot_id) OR a news article (news_id)

-- Index for news comments
CREATE INDEX IF NOT EXISTS idx_comments_news_id ON comments(news_id) WHERE news_id IS NOT NULL;

-- ── 4. RLS: allow user event/news submission ──

-- Events: public read published, users insert pending
DROP POLICY IF EXISTS "Users insert pending events" ON events;
CREATE POLICY "Users insert pending events" ON events
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by_user_id
    AND moderation_status = 'pending'
  );

-- News: public read published, users insert pending
DROP POLICY IF EXISTS "Users insert pending news" ON news;
CREATE POLICY "Users insert pending news" ON news
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by_user_id
    AND moderation_status = 'pending'
  );

-- Comments on news: same rules as spot comments
DROP POLICY IF EXISTS "Public read news comments" ON comments;
CREATE POLICY "Public read news comments" ON comments
  FOR SELECT USING (
    news_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM news WHERE id = news_id AND status = 'published')
  );
