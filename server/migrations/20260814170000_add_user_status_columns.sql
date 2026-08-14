-- Migration: Add missing is_active and is_verified columns to users table
-- Safe for environments where columns may already exist or be missing.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Ensure existing users have non-null active and verified status
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;
