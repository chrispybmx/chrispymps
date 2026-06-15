-- Events worldwide expansion
-- Aggiunge colonne per scraping multi-source + geocoding + discipline filter

ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_code TEXT; -- ISO 3166-1 alpha-2 (IT, FR, US, ...)
ALTER TABLE events ADD COLUMN IF NOT EXISTS date_end DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS discipline TEXT; -- park, street, flatland, race, mixed, dirt
ALTER TABLE events ADD COLUMN IF NOT EXISTS level TEXT; -- international, national, regional, local-jam
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_aggregator TEXT; -- uci, fise, fatbmx, illuminatebmx, manual
ALTER TABLE events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

-- Indexes per performance filter
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_country_code ON events(country_code);
CREATE INDEX IF NOT EXISTS idx_events_discipline ON events(discipline);
CREATE INDEX IF NOT EXISTS idx_events_level ON events(level);
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_events_source_aggregator ON events(source_aggregator);

-- Unique dedup constraint: stesso evento da fonti diverse non duplica
-- (slug è già UNIQUE; aggiungo soft-dedup index per match by name+date+city)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup
  ON events(LOWER(title), event_date, LOWER(COALESCE(city,'')))
  WHERE moderation_status = 'published';
