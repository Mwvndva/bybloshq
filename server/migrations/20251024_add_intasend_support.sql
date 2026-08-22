-- Migration: Add IntaSend support to payments table
-- This migration adds support for IntaSend payment gateway alongside existing Pesapal support

-- Add new payment method options
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'intasend';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'intasend_mpesa';

-- Add new columns for IntaSend-specific data
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS intasend_collection_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS intasend_stk_push_id VARCHAR(255);

-- Create index for IntaSend collection ID lookups
CREATE INDEX IF NOT EXISTS idx_product_orders_intasend_collection_id 
ON product_orders(intasend_collection_id);

-- Create index for IntaSend STK Push ID lookups  
CREATE INDEX IF NOT EXISTS idx_product_orders_intasend_stk_push_id 
ON product_orders(intasend_stk_push_id);

-- Update existing orders to have proper payment references
-- This ensures backward compatibility
UPDATE product_orders 
SET payment_reference = COALESCE(intasend_collection_id, intasend_stk_push_id, payment_reference)
WHERE payment_reference IS NULL 
AND (intasend_collection_id IS NOT NULL OR intasend_stk_push_id IS NOT NULL);

-- Add comment to document the new columns
COMMENT ON COLUMN product_orders.intasend_collection_id IS 'IntaSend payment collection ID for checkout payments';
COMMENT ON COLUMN product_orders.intasend_stk_push_id IS 'IntaSend STK Push ID for M-Pesa payments';
