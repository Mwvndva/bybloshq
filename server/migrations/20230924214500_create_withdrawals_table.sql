-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  mpesa_number VARCHAR(15) NOT NULL,
  registered_name VARCHAR(100) NOT NULL,
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
CREATE INDEX idx_withdrawals_seller_id ON withdrawals(seller_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- Add comments
COMMENT ON TABLE withdrawals IS 'Stores seller withdrawal requests';
COMMENT ON COLUMN withdrawals.status IS 'pending, approved, rejected, or processed';
COMMENT ON COLUMN withdrawals.processed_by IS 'Admin who processed the withdrawal';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawals_updated_at
BEFORE UPDATE ON withdrawals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
