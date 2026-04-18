-- UNIFIED PURCHASE ARCHITECTURE: Database Migration
-- Date: 2026-04-18
-- Adds flat columns to product_orders to eliminate relational JOIN dependencies for notifications.

-- 1. Add Buyer Identity Columns (Flat)
-- Note: These should already exist, but ensuring they are not null for future orders
ALTER TABLE product_orders ALTER COLUMN buyer_name SET NOT NULL;
ALTER TABLE product_orders ALTER COLUMN buyer_mobile_payment SET NOT NULL;

-- 2. Add Location Columns (Flat)
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10, 8);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_lng NUMERIC(11, 8);

-- 3. Add Service/Product Detail Columns (Flat)
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS service_title TEXT;
-- quantity and total_amount already exist as integer and numeric respectively

-- 4. Backfill existing orders from delivery_location and metadata (Best effort)
UPDATE product_orders
SET 
    location_lat = (delivery_location->>'lat')::numeric,
    location_lng = (delivery_location->>'lng')::numeric,
    location_address = (delivery_location->>'address')
WHERE delivery_location IS NOT NULL;

UPDATE product_orders
SET 
    service_title = (metadata->'items'->0->>'name')
WHERE service_title IS NULL AND metadata->'items' IS NOT NULL;

-- 5. Add status enum cleanup if needed (Standardizing to uppercase)
-- UPDATE product_orders SET status = UPPER(status);
