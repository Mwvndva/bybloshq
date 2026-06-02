-- Migration: unify non-seller withdrawals
-- Reason: Creator payouts and buyer refund withdrawals should use the same
-- withdrawal ledger, provider attempts, callback state machine, retries, and
-- reserve accounting as seller withdrawals.

ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS withdrawal_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (withdrawal_reserved_balance >= 0);

ALTER TABLE buyers
    ADD COLUMN IF NOT EXISTS refund_withdrawal_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (refund_withdrawal_reserved_balance >= 0);

ALTER TABLE withdrawal_requests
    ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES creators(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES buyers(id) ON DELETE CASCADE;

ALTER TABLE withdrawal_requests
    ALTER COLUMN seller_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'withdrawal_requests_one_entity_check'
    ) THEN
        ALTER TABLE withdrawal_requests
            ADD CONSTRAINT withdrawal_requests_one_entity_check
            CHECK (
                (seller_id IS NOT NULL AND creator_id IS NULL AND buyer_id IS NULL)
                OR (seller_id IS NULL AND creator_id IS NOT NULL AND buyer_id IS NULL)
                OR (seller_id IS NULL AND creator_id IS NULL AND buyer_id IS NOT NULL)
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_creator_idempotency_unique
    ON withdrawal_requests(creator_id, idempotency_key)
    WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_creator_status
    ON withdrawal_requests(creator_id, status)
    WHERE creator_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_buyer_refund_idempotency_unique
    ON withdrawal_requests(buyer_id, idempotency_key)
    WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_buyer_status
    ON withdrawal_requests(buyer_id, status)
    WHERE buyer_id IS NOT NULL;

INSERT INTO withdrawal_requests (
    seller_id,
    creator_id,
    amount,
    mpesa_number,
    mpesa_name,
    status,
    provider_reference,
    idempotency_key,
    metadata,
    created_at,
    updated_at,
    processed_at
)
SELECT
    NULL,
    cwr.creator_id,
    cwr.amount,
    cwr.mpesa_number,
    cwr.mpesa_name,
    cwr.status,
    cwr.provider_reference,
    cwr.idempotency_key,
    COALESCE(cwr.metadata, '{}'::jsonb)
        || jsonb_build_object(
            'entity_type', 'creator',
            'legacy_creator_withdrawal_request_id', cwr.id,
            'withdrawal_fee', cwr.withdrawal_fee,
            'total_deducted', cwr.total_deducted,
            'backfilled_from_creator_withdrawal_requests', true
        ),
    cwr.created_at,
    cwr.updated_at,
    cwr.processed_at
FROM creator_withdrawal_requests cwr
WHERE NOT EXISTS (
    SELECT 1
    FROM withdrawal_requests wr
    WHERE wr.creator_id = cwr.creator_id
      AND wr.idempotency_key = cwr.idempotency_key
);

ALTER TABLE payout_provider_attempts
    ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payout_provider_attempts_creator
    ON payout_provider_attempts(creator_id)
    WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_provider_attempts_buyer
    ON payout_provider_attempts(buyer_id)
    WHERE buyer_id IS NOT NULL;

ALTER TABLE payout_reconciliation_events
    ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_events_creator
    ON payout_reconciliation_events(creator_id, created_at DESC)
    WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_events_buyer
    ON payout_reconciliation_events(buyer_id, created_at DESC)
    WHERE buyer_id IS NOT NULL;
