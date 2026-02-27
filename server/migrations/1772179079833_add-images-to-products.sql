-- Up Migration
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Down Migration
ALTER TABLE products DROP COLUMN IF EXISTS images;