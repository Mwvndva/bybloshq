-- Migration: admin dashboard data integrity
-- Reason: Ensure buyer profiles have a status field on fresh databases without mutating existing enum-backed columns.

ALTER TABLE buyers
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
