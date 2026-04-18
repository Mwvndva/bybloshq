-- Migration: Hardening Order Schema
-- Description: Adds notification_sent flag and backfills legacy data.

-- 1. Add notification_sent flag
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

-- 2. Backfill flat columns for legacy orders (only if NULL)
-- This ensures notifications and tracking work for historic data.
UPDATE product_orders
SET 
  location_address = COALESCE(location_address, delivery_location->>'address', delivery_location->>'fullAddress', shipping_address, 'Not specified'),
  location_lat = COALESCE(location_lat, (delivery_location->>'lat')::numeric, (delivery_location->>'latitude')::numeric, 0),
  location_lng = COALESCE(location_lng, (delivery_location->>'lng')::numeric, (delivery_location->>'longitude')::numeric, 0),
  service_title = COALESCE(service_title, metadata->>'product_name', 'Service')
WHERE location_address IS NULL OR service_title IS NULL;

-- 3. Ensure indexing for performance on notification lookups
CREATE INDEX IF NOT EXISTS idx_orders_notification_sent ON product_orders(notification_sent);
