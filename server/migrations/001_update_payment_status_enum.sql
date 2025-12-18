DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'payment_status' AND e.enumlabel = 'completed') THEN
        ALTER TYPE payment_status ADD VALUE 'completed';
    END IF;
END $$;

-- Note: This migration should be run after the main schema migration
-- to ensure the enum exists before we try to modify it
