-- Migration: admin dashboard data integrity
-- Reason: Ensure admin user deletion can mark buyer profiles as deleted while preserving audit records.

ALTER TABLE buyers
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';

UPDATE buyers
SET status = COALESCE(NULLIF(status, ''), 'active');
