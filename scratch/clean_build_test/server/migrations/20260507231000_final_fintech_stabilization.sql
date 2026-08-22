-- Migration: Final fintech stabilization
-- Reason: Persist fraud evidence, checkout idempotency, and withdrawal retry leases.

ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS client_checkout_token VARCHAR(160);

CREATE UNIQUE INDEX IF NOT EXISTS product_orders_client_checkout_token_unique
    ON product_orders(client_checkout_token)
    WHERE client_checkout_token IS NOT NULL;

UPDATE product_orders
SET client_checkout_token = 'legacy:' || id::text
WHERE client_checkout_token IS NULL;

ALTER TABLE product_orders
    ALTER COLUMN client_checkout_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_orders_client_checkout_token_unique_all
    ON product_orders(client_checkout_token);

CREATE TABLE IF NOT EXISTS fraud_events (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    provider_reference VARCHAR(255),
    event_type VARCHAR(80) NOT NULL,
    expected_amount NUMERIC(15, 2),
    provider_amount NUMERIC(15, 2),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fraud_events
    ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS provider_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fraud_events_payment_id
    ON fraud_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_fraud_events_order_id
    ON fraud_events(order_id);

CREATE INDEX IF NOT EXISTS idx_fraud_events_provider_reference
    ON fraud_events(provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_provider_attempts (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    api_ref VARCHAR(160) NOT NULL,
    idempotency_key VARCHAR(160),
    provider_reference VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'provider_call_pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_attempts_payment_unique
    ON payment_provider_attempts(payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_attempts_api_ref_unique
    ON payment_provider_attempts(api_ref);

CREATE INDEX IF NOT EXISTS idx_payment_provider_attempts_status
    ON payment_provider_attempts(status, last_attempt_at);

ALTER TABLE withdrawal_requests
    ADD COLUMN IF NOT EXISTS retry_started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS retry_worker_id VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_seller_idempotency_unique
    ON withdrawal_requests(seller_id, idempotency_key);

CREATE TABLE IF NOT EXISTS payout_provider_attempts (
    id SERIAL PRIMARY KEY,
    withdrawal_request_id INTEGER NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(160) NOT NULL,
    provider_reference VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'provider_call_pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payout_provider_attempts_request_unique
    ON payout_provider_attempts(withdrawal_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS payout_provider_attempts_idempotency_unique
    ON payout_provider_attempts(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_payout_provider_attempts_status
    ON payout_provider_attempts(status, last_attempt_at);

CREATE TABLE IF NOT EXISTS payout_reconciliation_events (
    id BIGSERIAL PRIMARY KEY,
    withdrawal_request_id INTEGER REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    provider_reference VARCHAR(255),
    client_reference VARCHAR(160),
    reference_key VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payout_reconciliation_events_unique_reference
    ON payout_reconciliation_events(withdrawal_request_id, event_type, reference_key);

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_events_request
    ON payout_reconciliation_events(withdrawal_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_dedupe (
    event_id VARCHAR(255) PRIMARY KEY,
    event_name VARCHAR(120) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_dedupe_expires_at
    ON event_dedupe(expires_at);

CREATE TABLE IF NOT EXISTS event_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_name VARCHAR(120) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE event_outbox
    ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error_type VARCHAR(40),
    ADD COLUMN IF NOT EXISTS final_failure_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_event_outbox_retry
    ON event_outbox(status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed', 'processing');
