-- Migration: settlement-aware seller wallet
-- Reason: Paystack settlements are not immediately withdrawable. Seller earnings
-- should be visible after escrow release, then become withdrawable after settlement.

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS pending_settlement_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (pending_settlement_balance >= 0),
    ADD COLUMN IF NOT EXISTS withdrawal_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (withdrawal_reserved_balance >= 0),
    ADD COLUMN IF NOT EXISTS refund_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (refund_reserved_balance >= 0);

ALTER TABLE payouts
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(30) NOT NULL DEFAULT 'settled',
    ADD COLUMN IF NOT EXISTS settlement_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE sellers
SET pending_settlement_balance = COALESCE(pending_settlement_balance, 0),
    withdrawal_reserved_balance = COALESCE(withdrawal_reserved_balance, 0),
    refund_reserved_balance = COALESCE(refund_reserved_balance, 0),
    updated_at = NOW()
WHERE pending_settlement_balance IS NULL
   OR withdrawal_reserved_balance IS NULL
   OR refund_reserved_balance IS NULL;

-- Existing completed payouts were already credited to sellers.balance by earlier
-- migrations/runtime code, so keep them withdrawable instead of freezing sellers retroactively.
UPDATE payouts
SET settlement_status = 'settled',
    settled_at = COALESCE(settled_at, completed_at, processed_at, updated_at, created_at, NOW()),
    available_at = COALESCE(available_at, completed_at, processed_at, updated_at, created_at, NOW()),
    settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || '{"backfilled_as_settled":true}'::jsonb
WHERE status = 'completed'
  AND COALESCE(settlement_status, 'settled') <> 'pending_settlement';

CREATE INDEX IF NOT EXISTS idx_payouts_pending_settlement_available
    ON payouts(available_at, id)
    WHERE settlement_status = 'pending_settlement';

CREATE INDEX IF NOT EXISTS idx_payouts_seller_settlement_status
    ON payouts(seller_id, settlement_status);
