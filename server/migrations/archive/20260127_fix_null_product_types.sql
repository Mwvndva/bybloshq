-- Fix service products (infer from service_options)
UPDATE products SET product_type = 'service' WHERE product_type IS NULL AND service_options IS NOT NULL;

-- Fix physical products (default fallback for the rest)
UPDATE products SET product_type = 'physical' WHERE product_type IS NULL;

-- Enforce NOT NULL constraint to prevent regression
ALTER TABLE products ALTER COLUMN product_type SET NOT NULL;
