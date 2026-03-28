-- Migration: Add mpesa_receipt columns to tracking tables
-- Created: 2026-03-28

-- 1. Add mpesa_receipt to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_receipt ON payments(mpesa_receipt);

-- 2. Add mpesa_receipt to withdrawal_requests
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_withdrawals_mpesa_receipt ON withdrawal_requests(mpesa_receipt);

-- 3. Note: These columns store the 'third_party_trans_id' from Payd webhooks
-- providing definitive reconciliation back to Safaricom M-Pesa.
