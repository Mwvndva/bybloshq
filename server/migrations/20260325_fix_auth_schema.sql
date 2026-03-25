-- 20260325_fix_auth_schema.sql
-- Fixes missing columns in users table for hardening

DO $$
BEGIN
    -- 1. Add password_changed_at to users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_changed_at') THEN
        ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN users.password_changed_at IS 'Timestamp for when the password was last changed (used for JWT invalidation)';
    END IF;

    -- 2. Ensure is_active exists (redundant but safe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
