-- =============================================================================
-- REMOVE TICKETING & EVENT MANAGEMENT SYSTEM
-- =============================================================================
-- This migration removes all event, ticket, and organizer-related tables
-- CAUTION: This is DESTRUCTIVE and IRREVERSIBLE. Back up your database first!
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop Foreign Key Dependencies First
-- -----------------------------------------------------------------------------

-- Drop any foreign keys referencing events, tickets, organizers
ALTER TABLE IF EXISTS tickets DROP CONSTRAINT IF EXISTS tickets_event_id_fkey;
ALTER TABLE IF EXISTS tickets DROP CONSTRAINT IF EXISTS tickets_buyer_id_fkey;
ALTER TABLE IF EXISTS ticket_types DROP CONSTRAINT IF EXISTS ticket_types_event_id_fkey;
ALTER TABLE IF EXISTS discount_codes DROP CONSTRAINT IF EXISTS discount_codes_event_id_fkey;
ALTER TABLE IF EXISTS events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE IF EXISTS organizers DROP CONSTRAINT IF EXISTS organizers_user_id_fkey;

-- Drop any indexes
DROP INDEX IF EXISTS idx_tickets_event_id;
DROP INDEX IF EXISTS idx_tickets_buyer_id;
DROP INDEX IF EXISTS idx_events_organizer_id;
DROP INDEX IF EXISTS idx_events_status;
DROP INDEX IF EXISTS idx_tickets_status;
DROP INDEX IF EXISTS idx_organizers_email;

-- -----------------------------------------------------------------------------
-- 2. Drop Ticketing Tables
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS ticket_types CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- -----------------------------------------------------------------------------
-- 3. Drop Organizer Tables
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS organizers CASCADE;
DROP TABLE IF EXISTS organizer_roles CASCADE; -- If exists
DROP TABLE IF EXISTS event_activations CASCADE; -- If exists

-- -----------------------------------------------------------------------------
-- 4. Clean Up Related Data in Other Tables
-- -----------------------------------------------------------------------------

-- Remove organizer users from users table
-- First, identify those users. Note: Depending on your system, you might want to 
-- just change their role or deactivate them. Here we follow the plan to DELETE.
DELETE FROM users WHERE role = 'organizer';

-- Remove organizer-related permissions (if RBAC system exists)
DELETE FROM role_permissions 
WHERE role_id IN (
    SELECT id FROM roles WHERE slug = 'organizer'
);

DELETE FROM roles WHERE slug = 'organizer';

DELETE FROM permissions 
WHERE slug LIKE 'event.%' 
   OR slug LIKE 'ticket.%'
   OR slug LIKE 'organizer.%';

-- Remove organizer-related user_roles
DELETE FROM user_roles 
WHERE role_id IN (
    SELECT id FROM roles WHERE slug = 'organizer'
);

-- -----------------------------------------------------------------------------
-- 5. Drop ENUMs Related to Events/Tickets
-- -----------------------------------------------------------------------------

-- Drop ticket status enum
DROP TYPE IF EXISTS ticket_status CASCADE;

-- Drop event status enum
DROP TYPE IF EXISTS event_status CASCADE;

-- -----------------------------------------------------------------------------
-- 6. Clean Up Orders Table (if tickets were orders)
-- -----------------------------------------------------------------------------

-- If tickets created order_items, remove them
DELETE FROM order_items 
WHERE product_type = 'ticket' OR product_type = 'event';

-- Remove any orders that only had tickets (now have 0 items)
DELETE FROM orders 
WHERE id NOT IN (
    SELECT DISTINCT order_id FROM order_items
);

-- -----------------------------------------------------------------------------
-- 7. Update Product Type Enum (Remove 'ticket' if exists)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ticket' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'product_type')
    ) THEN
        -- Recreate enum without 'ticket'
        
        -- 1. Create temporary enum
        CREATE TYPE product_type_new AS ENUM ('physical', 'digital', 'service');
        
        -- 2. Alter column to use new type
        ALTER TABLE products 
            ALTER COLUMN type TYPE product_type_new 
            USING type::text::product_type_new;
        
        -- 3. Drop old enum
        DROP TYPE product_type;
        
        -- 4. Rename new enum
        ALTER TYPE product_type_new RENAME TO product_type;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Clean Up Platform Fees (if event-specific)
-- -----------------------------------------------------------------------------

DELETE FROM platform_fees 
WHERE product_type = 'ticket' OR product_type = 'event';

COMMIT;
