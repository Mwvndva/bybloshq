-- Migration: Drop shipping_address column from product_orders
-- Reason: Redundant field, products are fulfilled via seller-pickup or courier hubs.

ALTER TABLE product_orders DROP COLUMN IF EXISTS shipping_address;
