-- This migration is no longer needed as the orders table is created in a previous migration
-- (20250923190000_create_orders_table.sql)

-- Add any missing columns (using IF NOT EXISTS to be safe)
ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS payment_method_description VARCHAR(255);

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS callback_url TEXT;

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS cancellation_url TEXT;

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS notification_id VARCHAR(255);

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS ipn_notification_type VARCHAR(50);

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_orders_updated_at'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'orders'
    ) THEN
        CREATE TRIGGER update_orders_updated_at
        BEFORE UPDATE ON orders
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
