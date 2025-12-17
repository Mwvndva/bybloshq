-- Create refund_requests table
CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    order_id INTEGER,
    ticket_id INTEGER,
    amount DECIMAL(12, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by INTEGER REFERENCES organizers(id),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_id ON refund_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested_at ON refund_requests(requested_at);

-- Create trigger to update updated_at column
CREATE TRIGGER update_refund_requests_updated_at
    BEFORE UPDATE ON refund_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
