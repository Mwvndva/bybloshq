-- Add total_sales and net_revenue columns to sellers table
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW; 
END;
$$ language 'plpgsql';

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sellers_modtime') THEN
        CREATE TRIGGER update_sellers_modtime
        BEFORE UPDATE ON sellers
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;
