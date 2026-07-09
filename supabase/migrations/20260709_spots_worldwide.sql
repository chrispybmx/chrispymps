-- Spots worldwide expansion
-- Aggiunge country/country_code agli spot (stesso pattern di 20260504_events_worldwide.sql).
-- Gli spot esistenti sono tutti italiani → backfill IT.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS country_code TEXT; -- ISO 3166-1 alpha-2 (IT, FR, US, ...)

-- Backfill: tutto lo storico è Italia
UPDATE spots SET country = 'Italia', country_code = 'IT' WHERE country_code IS NULL;

-- Filtri per paese (mappa/ricerca world-wide)
CREATE INDEX IF NOT EXISTS idx_spots_country_code ON spots(country_code);
