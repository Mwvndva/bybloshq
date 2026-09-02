-- Add sold_at and is_sold columns to products table for sold timestamp and status tracking
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_sold BOOLEAN DEFAULT FALSE;

-- Synchronize is_sold boolean flag based on status column
UPDATE products
SET is_sold = (LOWER(COALESCE(status, '')) = 'sold')
WHERE is_sold IS NULL OR is_sold != (LOWER(COALESCE(status, '')) = 'sold');
