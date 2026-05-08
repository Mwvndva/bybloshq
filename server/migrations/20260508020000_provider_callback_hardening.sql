-- Migration: provider callback hardening
-- Reason: Prevent ambiguous payout callback resolution and make webhook replay retries recoverable.

DO $$
BEGIN
    IF EXISTS (
        SELECT provider_reference
        FROM payout_provider_attempts
        WHERE provider_reference IS NOT NULL
        GROUP BY provider_reference
        HAVING COUNT(DISTINCT withdrawal_request_id) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate payout_provider_attempts.provider_reference values exist; resolve before applying uniqueness constraint';
    END IF;

    IF EXISTS (
        SELECT provider_reference
        FROM withdrawal_requests
        WHERE provider_reference IS NOT NULL
        GROUP BY provider_reference
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate withdrawal_requests.provider_reference values exist; resolve before applying uniqueness constraint';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payout_provider_attempts_provider_reference_unique
    ON payout_provider_attempts(provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_provider_reference_unique
    ON withdrawal_requests(provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payout_reconciliation_events_global_reference_unique
    ON payout_reconciliation_events(event_type, reference_key)
    WHERE withdrawal_request_id IS NULL;

ALTER TABLE webhook_replay_dedupe
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'processing',
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_replay_dedupe_status
    ON webhook_replay_dedupe(status, updated_at, expires_at)
    WHERE status IN ('processing', 'failed');
