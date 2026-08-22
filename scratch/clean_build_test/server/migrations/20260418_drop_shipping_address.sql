-- Migration: Drop shipping_address column from product_orders
-- Reason: Redundant field, products are fulfilled via seller-pickup or courier hubs.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_orders') THEN
        ALTER TABLE product_orders DROP COLUMN IF EXISTS shipping_address;
    END IF;
END $$;
