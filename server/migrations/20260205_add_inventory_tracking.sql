-- Migration: Add Inventory Tracking to Products
-- Date: 2026-02-05
-- Description: Adds inventory tracking columns to products table with constraints

-- Add inventory tracking columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- Add constraint to prevent negative quantity
ALTER TABLE products
ADD CONSTRAINT quantity_non_negative CHECK (quantity IS NULL OR quantity >= 0);

-- Set default track_inventory to FALSE for digital products and services
UPDATE products 
SET track_inventory = FALSE 
WHERE product_type IN ('digital', 'service') OR is_digital = TRUE;

-- Set default track_inventory to TRUE for physical products with NULL values
UPDATE products 
SET track_inventory = TRUE 
WHERE product_type = 'physical' AND is_digital = FALSE AND track_inventory IS NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN products.track_inventory IS 'Whether to track inventory for this product. Digital and service products default to FALSE.';
COMMENT ON COLUMN products.quantity IS 'Current stock quantity. NULL means unlimited/not tracked. Must be >= 0.';
COMMENT ON COLUMN products.low_stock_threshold IS 'Threshold for low stock alerts. Default is 5 units.';

-- Create index for inventory queries
CREATE INDEX IF NOT EXISTS idx_products_inventory ON products(track_inventory, quantity) WHERE track_inventory = TRUE;
