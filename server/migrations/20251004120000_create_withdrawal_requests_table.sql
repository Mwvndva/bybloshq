-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    mpesa_number VARCHAR(15) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(100),
    CONSTRAINT valid_mpesa_number CHECK (mpesa_number ~ '^[0-9]{10,15}$')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_seller_id ON withdrawal_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for sellers to only see their own requests
-- CREATE POLICY seller_withdrawal_requests ON withdrawal_requests
--     FOR ALL USING (seller_id = current_setting('app.current_seller_id', true)::integer);

-- Create policy for admins to see all requests
-- CREATE POLICY admin_withdrawal_requests ON withdrawal_requests
--     FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');
