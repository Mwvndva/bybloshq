-- Add tracking columns for Payd integration
-- Created: 2026-03-05

-- 1. Update payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- 2. Update withdrawal_requests table
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(100);
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- 3. Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref ON withdrawal_requests(provider_reference);

-- 4. Note: api_ref already exists in payments (used for polling), 
-- provider_reference will store Payd's internal ID (transaction_id/reference)
