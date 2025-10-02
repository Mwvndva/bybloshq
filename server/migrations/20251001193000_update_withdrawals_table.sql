-- Update seller_withdrawals table to better track seller payouts
ALTER TABLE seller_withdrawals 
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fee DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount DECIMAL(12, 2) GENERATED ALWAYS AS (amount - COALESCE(fee, 0)) STORED,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS bank_details JSONB,
  ADD COLUMN IF NOT EXISTS receipt_data JSONB,
  ADD COLUMN IF NOT EXISTS initiated_by INTEGER, -- Will add reference later if users table exists
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update existing columns if needed
ALTER TABLE seller_withdrawals 
  ALTER COLUMN status TYPE VARCHAR(50),
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN mpesa_number DROP NOT NULL,
  ALTER COLUMN registered_name DROP NOT NULL;

-- Add check constraints
ALTER TABLE seller_withdrawals 
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  ADD CONSTRAINT valid_payment_method CHECK (payment_method IN ('mpesa', 'bank_transfer', 'other')),
  ADD CONSTRAINT positive_amount CHECK (amount > 0),
  ADD CONSTRAINT non_negative_fee CHECK (fee >= 0);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_seller_status ON seller_withdrawals(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_created_at ON seller_withdrawals(created_at);
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_reference ON seller_withdrawals(reference_number);
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_transaction_id ON seller_withdrawals(transaction_id);

-- Add comments
COMMENT ON TABLE seller_withdrawals IS 'Tracks withdrawal requests from sellers for their earnings';
COMMENT ON COLUMN seller_withdrawals.seller_id IS 'Reference to the seller requesting the withdrawal';
COMMENT ON COLUMN seller_withdrawals.amount IS 'Gross amount to be withdrawn';
COMMENT ON COLUMN seller_withdrawals.fee IS 'Transaction fee for the withdrawal';
COMMENT ON COLUMN seller_withdrawals.net_amount IS 'Amount after deducting fees (generated column)';
COMMENT ON COLUMN seller_withdrawals.status IS 'Current status of the withdrawal request';
COMMENT ON COLUMN seller_withdrawals.payment_method IS 'Method used for the withdrawal (mpesa, bank_transfer, etc.)';
COMMENT ON COLUMN seller_withdrawals.transaction_id IS 'Reference ID from the payment processor';
COMMENT ON COLUMN seller_withdrawals.receipt_data IS 'Raw response data from the payment processor';
COMMENT ON COLUMN seller_withdrawals.metadata IS 'Additional metadata about the withdrawal';

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_withdrawal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_seller_withdrawal_updated_at_trigger ON seller_withdrawals;
CREATE TRIGGER update_seller_withdrawal_updated_at_trigger
BEFORE UPDATE ON seller_withdrawals
FOR EACH ROW
EXECUTE FUNCTION update_withdrawal_updated_at();

-- Conditionally add the foreign key constraint if users table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE seller_withdrawals 
      ADD CONSTRAINT fk_seller_withdrawals_initiated_by 
      FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
