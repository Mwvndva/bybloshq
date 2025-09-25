-- Add metadata column to orders table
ALTER TABLE orders
ADD COLUMN metadata JSONB;

-- Add an index to the metadata column for faster queries (optional but recommended)
CREATE INDEX idx_orders_metadata ON orders USING GIN (metadata);
