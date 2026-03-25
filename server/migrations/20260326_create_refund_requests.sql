-- M-13 FIX: Create refund_requests table
-- Referenced by buyer.controller.js and admin controllers but missing from all migrations.
-- Fresh deployments crash without this table.

CREATE TABLE IF NOT EXISTS refund_requests (
    id               SERIAL PRIMARY KEY,
    buyer_id         INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    amount           DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'rejected')),
    payment_method   VARCHAR(50) NOT NULL DEFAULT 'M-Pesa',
    payment_details  JSONB,
    requested_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at     TIMESTAMP WITH TIME ZONE,
    processed_by     INTEGER REFERENCES users(id),
    admin_notes      TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer
    ON refund_requests (buyer_id, status);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status
    ON refund_requests (status, requested_at DESC);
