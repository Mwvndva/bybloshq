-- BYBLOS BACKEND HARDENING: FULFILLMENT & LOGISTICS
-- Date: 2026-04-17

-- 1. Create fulfillment_type enum if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN
        CREATE TYPE fulfillment_type AS ENUM ('BUYER_TO_SELLER', 'COURIER', 'SELLER_TO_BUYER', 'DIGITAL');
    END IF;
END $$;

-- 2. Add columns to product_orders
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS fulfillment_type fulfillment_type;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS delivery_location JSONB;

-- 3. Backfill existing orders based on current rules
-- Note: This is a best-effort backfill.
-- Sellers with physical_address -> BUYER_TO_SELLER
-- Sellers without physical_address and physical product -> COURIER

UPDATE product_orders o
SET fulfillment_type = 'BUYER_TO_SELLER'
FROM sellers s
WHERE o.seller_id = s.id
AND s.physical_address IS NOT NULL
AND o.fulfillment_type IS NULL;

-- Default remaining physical/unknown to COURIER or based on product type in metadata
UPDATE product_orders
SET fulfillment_type = 'COURIER'
WHERE fulfillment_type IS NULL
AND (metadata->>'product_type' = 'physical' OR metadata->>'product_type' IS NULL);

UPDATE product_orders
SET fulfillment_type = 'SELLER_TO_BUYER'
WHERE fulfillment_type IS NULL
AND metadata->>'product_type' = 'service';

UPDATE product_orders
SET fulfillment_type = 'DIGITAL'
WHERE fulfillment_type IS NULL
AND metadata->>'product_type' = 'digital';

-- 4. Mark fulfillment_type as NOT NULL after backfill
-- ALTER TABLE product_orders ALTER COLUMN fulfillment_type SET NOT NULL;
