-- 001_add_password_reset_fields.sql
-- Add password reset token fields to sellers table

-- Add password reset token fields to sellers table
ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;

-- Create index on password_reset_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_sellers_password_reset_token ON sellers(password_reset_token);

-- Create index on password_reset_expires for cleanup tasks
CREATE INDEX IF NOT EXISTS idx_sellers_password_reset_expires ON sellers(password_reset_expires);
