-- Migration: Add refunds column to buyers table
-- Reason: Required for tracking cumulative refunds available for withdrawal.

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS refunds NUMERIC(12, 2) DEFAULT 0;
