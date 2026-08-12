-- Migration: admin dashboard data integrity
-- Reason: Ensure buyer profiles have a status field on fresh databases without mutating existing enum-backed columns.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        ALTER TABLE buyers ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
    END IF;
END $$;
