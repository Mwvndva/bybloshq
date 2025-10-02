-- Create seller_withdrawals table
CREATE TABLE IF NOT EXISTS seller_withdrawals (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  mpesa_number VARCHAR(15),
  registered_name VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_seller_withdrawals_seller_id ON seller_withdrawals(seller_id);
CREATE INDEX idx_seller_withdrawals_status ON seller_withdrawals(status);

-- Add comments
COMMENT ON TABLE seller_withdrawals IS 'Tracks withdrawal requests from sellers for their earnings';
COMMENT ON COLUMN seller_withdrawals.seller_id IS 'Reference to the seller requesting the withdrawal';
COMMENT ON COLUMN seller_withdrawals.amount IS 'Amount to be withdrawn';
COMMENT ON COLUMN seller_withdrawals.status IS 'Current status of the withdrawal request';
COMMENT ON COLUMN seller_withdrawals.mpesa_number IS 'MPESA number for withdrawal (if applicable)';
COMMENT ON COLUMN seller_withdrawals.registered_name IS 'Name registered with MPESA (if applicable)';
COMMENT ON COLUMN seller_withdrawals.processed_by IS 'Admin user who processed the withdrawal';

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_withdrawal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_seller_withdrawals_updated_at
BEFORE UPDATE ON seller_withdrawals
FOR EACH ROW
EXECUTE FUNCTION update_withdrawal_timestamp();
