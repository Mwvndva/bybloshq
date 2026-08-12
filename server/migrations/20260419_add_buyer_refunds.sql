-- Migration: Add refunds column to buyers table
-- Reason: Required for tracking cumulative refunds available for withdrawal.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        ALTER TABLE buyers ADD COLUMN IF NOT EXISTS refunds NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;
