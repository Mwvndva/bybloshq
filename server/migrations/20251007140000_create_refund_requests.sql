-- Migration: Create refund_requests table
-- Description: Tracks buyer refund withdrawal requests for admin approval

CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_details JSONB,
    notes TEXT,
    admin_notes TEXT,
    processed_by INTEGER,
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_id ON refund_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested_at ON refund_requests(requested_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_refund_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_refund_requests_updated_at ON refund_requests;
CREATE TRIGGER trigger_update_refund_requests_updated_at
    BEFORE UPDATE ON refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_refund_requests_updated_at();

-- Add comment
COMMENT ON TABLE refund_requests IS 'Stores buyer refund withdrawal requests pending admin approval';

