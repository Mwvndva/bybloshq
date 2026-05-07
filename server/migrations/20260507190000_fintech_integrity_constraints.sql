-- Migration: Fintech integrity constraints
-- Reason: Add missing payout/withdrawal tables and uniqueness guards used by the active services.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FULFILLMENT_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FULFILLED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'BOOKED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COMPENSATION_REQUIRED';

CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    platform_fee NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    mpesa_number VARCHAR(50) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    provider_reference VARCHAR(255),
    mpesa_receipt VARCHAR(80),
    raw_response JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    api_call_pending BOOLEAN DEFAULT FALSE,
    idempotency_key VARCHAR(120) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payouts_order_id_unique
    ON payouts(order_id)
    WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_jobs_order_id_unique
    ON fulfillment_jobs(order_id);

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_idempotency_key_unique
    ON withdrawal_requests(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_provider_reference_unique
    ON withdrawal_requests(provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON payments(provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_api_ref
    ON payments(api_ref)
    WHERE api_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_seller_status
    ON withdrawal_requests(seller_id, status);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_processing
    ON withdrawal_requests(status, api_call_pending, created_at)
    WHERE status = 'processing';
