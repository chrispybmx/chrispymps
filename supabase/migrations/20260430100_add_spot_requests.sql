-- Spot Request support in news table
ALTER TABLE news ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'post';
ALTER TABLE news ADD COLUMN IF NOT EXISTS request_city TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS request_resolved BOOLEAN DEFAULT false;
