-- Migration: Remove Organizer and Ticketing system
-- Created: 2026-04-10

-- 1. Drop ticket and event related tables (order matters for FKs)
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS ticket_purchases CASCADE;
DROP TABLE IF EXISTS event_ticket_types CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS organizers CASCADE;

-- 2. Drop columns from payments
ALTER TABLE payments DROP COLUMN IF EXISTS organizer_id;
ALTER TABLE payments DROP COLUMN IF EXISTS event_id;

-- 3. Drop columns from withdrawal_requests
ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS organizer_id;
ALTER TABLE withdrawal_requests DROP COLUMN IF EXISTS event_id;

-- 4. Update users role check constraint
-- First, find the constraint name (usually users_role_check)
DO $$
DECLARE
    const_name TEXT;
BEGIN
    SELECT constraint_name INTO const_name
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND column_name = 'role'
    LIMIT 1;

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('buyer', 'seller', 'admin'));

-- 5. Cleanup permissions/roles (optional but good for consistency)
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE slug = 'organizer');
DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE slug = 'organizer');
DELETE FROM roles WHERE slug = 'organizer';
DELETE FROM permissions WHERE slug IN ('create-events', 'verify-tickets');
