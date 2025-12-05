-- Migration: Remove IntaSend and M-Pesa support, keep only Paystack
-- This migration cleans up payment providers to use only Paystack

-- Drop IntaSend-specific columns (they were added by the previous migration)
DO $$
BEGIN
    -- Drop indexes first
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'product_orders' AND indexname = 'idx_product_orders_intasend_collection_id') THEN
        DROP INDEX idx_product_orders_intasend_collection_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'product_orders' AND indexname = 'idx_product_orders_intasend_stk_push_id') THEN
        DROP INDEX idx_product_orders_intasend_stk_push_id;
    END IF;
    
    -- Drop columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_orders' AND column_name = 'intasend_collection_id') THEN
        ALTER TABLE product_orders DROP COLUMN intasend_collection_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_orders' AND column_name = 'intasend_stk_push_id') THEN
        ALTER TABLE product_orders DROP COLUMN intasend_stk_push_id;
    END IF;
END $$;

-- Update payment method enum to only include paystack
-- Note: PostgreSQL doesn't support removing enum values directly, 
-- so we'll create a new enum type and migrate to it

-- Create new payment method enum with only paystack
CREATE TYPE payment_method_new AS ENUM ('paystack');

-- Update tables to use the new enum type
ALTER TABLE payments ALTER COLUMN payment_method TYPE payment_method_new USING 'paystack'::payment_method_new;
ALTER TABLE product_orders ALTER COLUMN payment_method TYPE payment_method_new USING 'paystack'::payment_method_new;

-- Drop the old enum type
DROP TYPE payment_method;

-- Rename the new enum type to the original name
ALTER TYPE payment_method_new RENAME TO payment_method;

-- Update existing records to use 'paystack' as the payment method
UPDATE payments SET payment_method = 'paystack' WHERE payment_method IS NOT NULL;
UPDATE product_orders SET payment_method = 'paystack' WHERE payment_method IS NOT NULL;

-- Add comment to document the payment method
COMMENT ON COLUMN payments.payment_method IS 'Payment method - currently only supports Paystack';
COMMENT ON COLUMN product_orders.payment_method IS 'Payment method - currently only supports Paystack';
