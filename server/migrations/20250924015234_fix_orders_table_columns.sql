-- Update orders table to fix column names and add missing columns
BEGIN;

-- Rename amount to total_amount if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'amount') THEN
        ALTER TABLE orders RENAME COLUMN amount TO total_amount;
    END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS payment_method_description VARCHAR(255),
    ADD COLUMN IF NOT EXISTS shipping_address JSONB,
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES buyers(id);

-- Add default values
ALTER TABLE orders 
    ALTER COLUMN country_code SET DEFAULT 'KE',
    ALTER COLUMN currency SET DEFAULT 'KES',
    ALTER COLUMN status SET DEFAULT 'pending',
    ALTER COLUMN payment_status SET DEFAULT 'pending',
    ALTER COLUMN payment_method SET DEFAULT 'pesapal',
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Add comments for new columns
COMMENT ON COLUMN orders.payment_method_description IS 'Description of the payment method used';
COMMENT ON COLUMN orders.shipping_address IS 'Shipping address in JSON format';
COMMENT ON COLUMN orders.metadata IS 'Additional metadata for the order';
COMMENT ON COLUMN orders.buyer_id IS 'Reference to the buyer who placed the order';

COMMIT;
