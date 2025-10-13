-- Add banner_image column to sellers table
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS banner_image TEXT;
