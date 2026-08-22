-- Add 'paid' value to payment_status enum
-- This migration adds the 'paid' status to support the new delivery flow

-- Add 'paid' to the payment_status enum
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';

-- Update the comment to reflect the new values
COMMENT ON TYPE payment_status IS 'Payment status enum: pending, paid, completed, failed, cancelled';
