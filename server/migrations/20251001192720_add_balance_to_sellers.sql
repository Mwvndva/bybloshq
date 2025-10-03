-- Add balance column to sellers table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'balance') THEN
        ALTER TABLE sellers ADD COLUMN balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;

-- Update existing sellers to have balance = 0 if the column was just added
UPDATE sellers SET balance = 0.00 WHERE balance IS NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at when balance changes
DROP TRIGGER IF EXISTS update_seller_balance_updated_at ON sellers;
CREATE TRIGGER update_seller_balance_updated_at
BEFORE UPDATE OF balance ON sellers
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION update_seller_updated_at();
