-- Add password_changed_at column to buyers table
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_buyers_password_changed_at ON buyers(password_changed_at);
