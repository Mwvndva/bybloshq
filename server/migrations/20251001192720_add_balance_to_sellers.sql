-- Add balance column to sellers table
ALTER TABLE sellers 
ADD COLUMN balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at when balance changes
CREATE OR REPLACE TRIGGER update_seller_balance_updated_at
BEFORE UPDATE OF balance ON sellers
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION update_seller_updated_at();
