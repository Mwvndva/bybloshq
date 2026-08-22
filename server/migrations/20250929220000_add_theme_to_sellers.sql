-- Add theme column to sellers table
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'default';
