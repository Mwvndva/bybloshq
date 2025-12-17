-- Add last_login column to buyers table
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_buyers_last_login ON buyers(last_login);
