-- Add 'completed' to payment_status enum
-- This fixes the issue where payment_completion service tries to use 'completed' status
-- but the enum only includes 'pending', 'success', 'failed', 'reversed'

-- First, add the new value to the enum
ALTER TYPE payment_status ADD VALUE 'completed';

-- Note: This migration should be run after the main schema migration
-- to ensure the enum exists before we try to modify it
