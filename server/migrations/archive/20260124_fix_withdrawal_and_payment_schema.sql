-- 20260124_fix_withdrawal_and_payment_schema.sql
-- Fixes for Payd V2 integration and Withdrawal logic isolation

-- 1. Add ticket_type_id to payments table if missing
-- This is used to link payments directly to ticket types for downstream ticket generation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='ticket_type_id') THEN
        ALTER TABLE payments ADD COLUMN ticket_type_id INTEGER REFERENCES event_ticket_types(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Fix the owner check constraint on withdrawal_requests
-- The original constraint was too restrictive for event-based withdrawals
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_owner_check;

ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_owner_check CHECK (
    -- Case 1: Seller withdrawal (only seller_id set)
    (seller_id IS NOT NULL AND organizer_id IS NULL AND event_id IS NULL) OR 
    -- Case 2: Organizer account withdrawal (only organizer_id set)
    (seller_id IS NULL AND organizer_id IS NOT NULL AND event_id IS NULL) OR
    -- Case 3: Event-based withdrawal (organizer_id AND event_id set)
    (seller_id IS NULL AND organizer_id IS NOT NULL AND event_id IS NOT NULL)
);

-- 3. Add index for performance on new payments column
CREATE INDEX IF NOT EXISTS idx_payments_ticket_type ON payments(ticket_type_id);
