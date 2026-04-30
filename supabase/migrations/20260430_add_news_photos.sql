-- News extra photos
CREATE TABLE IF NOT EXISTS news_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_photos_news_id_position
ON news_photos(news_id, position);

ALTER TABLE news_photos ENABLE ROW LEVEL SECURITY;

-- Public read: only if parent news is published
CREATE POLICY "news_photos_public_read" ON news_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM news
      WHERE news.id = news_photos.news_id
      AND news.status = 'published'
    )
  );
