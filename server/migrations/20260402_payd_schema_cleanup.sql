-- Fix 18: Payd Schema Cleanup and Performance Optimization
-- Migration: 20260402_payd_schema_cleanup.sql

-- 1. Remove obsolete organizer/event references from withdrawal_requests
ALTER TABLE withdrawal_requests 
DROP COLUMN IF EXISTS organizer_id,
DROP COLUMN IF EXISTS event_id;

-- 2. Remove obsolete organizer/event references from payments
ALTER TABLE payments
DROP COLUMN IF EXISTS organizer_id,
DROP COLUMN IF EXISTS event_id;

-- 3. Add api_call_pending to withdrawal_requests to track reconciliation state
ALTER TABLE withdrawal_requests
ADD COLUMN IF NOT EXISTS api_call_pending BOOLEAN DEFAULT FALSE;

-- 4. Performance Indexes for Payment and Withdrawal processing
CREATE INDEX IF NOT EXISTS idx_payments_pending_retry 
ON payments (status, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_withdrawal_reconcile 
ON withdrawal_requests (status, created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_payments_provider_ref 
ON payments (provider_reference) 
WHERE provider_reference IS NOT NULL;
