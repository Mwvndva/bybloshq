-- 20260401_cleanup_organizer_tables.sql
-- COMPREHENSIVE CLEANUP: Removing all legacy ticketing/organizer infrastructure

BEGIN;

-- 1. Drop ticketing and event tables
DROP TABLE IF EXISTS event_tickets CASCADE;
DROP TABLE IF EXISTS event_ticket_types CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS organizers CASCADE;

-- 2. Clean up product_orders table
-- Remove organizer-specific columns if they exist
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_orders' AND column_name = 'organizer_id') THEN
        ALTER TABLE product_orders DROP COLUMN organizer_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_orders' AND column_name = 'event_id') THEN
        ALTER TABLE product_orders DROP COLUMN event_id;
    END IF;
END $$;

-- 3. Clean up withdrawal_requests table
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'organizer_id') THEN
        ALTER TABLE withdrawal_requests DROP COLUMN organizer_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'event_id') THEN
        ALTER TABLE withdrawal_requests DROP COLUMN event_id;
    END IF;
END $$;

-- 4. Clean up users table
-- We keep 'seller' and 'buyer' and 'admin' roles.
-- Any user with 'organizer' role should be downgraded to 'buyer' or removed if orphaned.
UPDATE users SET role = 'buyer' WHERE role = 'organizer';

-- 5. Finalize removal of non-existent table references in code-related logic
-- (Note: product_ratings was mentioned in the audit as non-existent, so we ensure it's not here)
DROP TABLE IF EXISTS product_ratings CASCADE;

COMMIT;
