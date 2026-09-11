-- 20250830_add_provider_reference_to_payments.sql
-- Adds provider_reference column to payments table

-- Add the provider_reference column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference 
ON payments(provider_reference);

-- Add comment for documentation
COMMENT ON COLUMN payments.provider_reference 
IS 'Reference ID from the payment provider (e.g., IntaSend, M-Pesa)';
