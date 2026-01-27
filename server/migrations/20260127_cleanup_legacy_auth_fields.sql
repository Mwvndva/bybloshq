-- Migration: Cleanup Legacy Auth Fields
-- Description: Drops password and reset token columns from sellers and organizers tables as auth is now unified in users table.

-- Sellers Table
ALTER TABLE sellers DROP COLUMN IF EXISTS password;
ALTER TABLE sellers DROP COLUMN IF EXISTS password_reset_token;
ALTER TABLE sellers DROP COLUMN IF EXISTS password_reset_expires;

-- Organizers Table
ALTER TABLE organizers DROP COLUMN IF EXISTS password;
ALTER TABLE organizers DROP COLUMN IF EXISTS password_reset_token;
ALTER TABLE organizers DROP COLUMN IF EXISTS password_reset_expires;
