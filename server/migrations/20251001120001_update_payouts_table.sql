-- Update payouts table with required columns

-- Add platform_fee column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'platform_fee') THEN
        ALTER TABLE payouts ADD COLUMN platform_fee DECIMAL(12, 2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add payout_method column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'payout_method') THEN
        ALTER TABLE payouts ADD COLUMN payout_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer';
    END IF;
END $$;

-- Add reference_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'reference_number') THEN
        ALTER TABLE payouts ADD COLUMN reference_number VARCHAR(100);
    END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'notes') THEN
        ALTER TABLE payouts ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add created_at and updated_at if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'created_at') THEN
        ALTER TABLE payouts ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payouts' AND column_name = 'updated_at') THEN
        ALTER TABLE payouts ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create or update indexes
CREATE INDEX IF NOT EXISTS idx_payouts_seller_id ON payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- Add comments to document the table
COMMENT ON TABLE payouts IS 'Stores information about payouts to sellers';
COMMENT ON COLUMN payouts.platform_fee IS 'The fee taken by the platform for this payout';
COMMENT ON COLUMN payouts.payout_method IS 'The method used for the payout (e.g., bank_transfer, paypal)';
COMMENT ON COLUMN payouts.reference_number IS 'Reference number for the payout transaction';
COMMENT ON COLUMN payouts.notes IS 'Additional notes about the payout';
