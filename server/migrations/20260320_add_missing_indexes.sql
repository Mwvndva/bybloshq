-- ISSUE 8: Add missing indexes for performance and integrity

-- 1. Composite index for fuzzy matching pending payments
CREATE INDEX IF NOT EXISTS idx_payments_fuzzy_match 
ON payments (status, mobile_payment) 
WHERE status = 'pending';

-- 3. Unique index on payouts(order_id) for EscrowManager idempotency
-- This is REQUIRED for ON CONFLICT clauses to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_order_id_unique 
ON payouts (order_id);
