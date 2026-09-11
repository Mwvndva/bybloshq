-- 20250831_add_api_ref_to_payments.sql
-- Adds api_ref column to payments table for storing payment provider's API reference

-- Add the api_ref column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS api_ref VARCHAR(255);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_api_ref 
ON payments(api_ref);

-- Add comment for documentation
COMMENT ON COLUMN payments.api_ref 
IS 'API reference ID from the payment provider (e.g., IntaSend invoice ID)';

-- Update existing payments if needed
-- UPDATE payments SET api_ref = invoice_id WHERE api_ref IS NULL;
