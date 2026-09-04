-- Add instagram_link and tiktok_link to creators table
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS instagram_link TEXT,
ADD COLUMN IF NOT EXISTS tiktok_link TEXT;
