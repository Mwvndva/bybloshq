-- 20260208_fix_dashboard_schema_final.sql
-- Fixes missing columns in events, user-related tables and renames wishlist table.

-- 1. Add missing withdrawal columns to events table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'withdrawal_status') THEN
        ALTER TABLE events ADD COLUMN withdrawal_status VARCHAR(20) DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'withdrawal_date') THEN
        ALTER TABLE events ADD COLUMN withdrawal_date TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'withdrawal_amount') THEN
        ALTER TABLE events ADD COLUMN withdrawal_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

-- 2. Add is_active column to users and sellers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'is_active') THEN
        ALTER TABLE sellers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 3. Rename wishlist to wishlists if a table named 'wishlist' exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists') THEN
        ALTER TABLE wishlist RENAME TO wishlists;
    END IF;
END $$;
