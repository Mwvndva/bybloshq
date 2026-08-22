-- Add payment_completed_at column to product_orders table
ALTER TABLE product_orders 
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;

-- Update existing completed orders
UPDATE product_orders 
SET payment_completed_at = completed_at 
WHERE status = 'COMPLETED' AND payment_status = 'completed' AND payment_completed_at IS NULL;
