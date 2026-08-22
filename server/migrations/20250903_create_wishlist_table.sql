-- 20250905_create_wishlist_table.sql
-- Create wishlist table to store buyer's wishlist items

-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(buyer_id, product_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wishlist_buyer_id ON wishlist(buyer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_wishlist_updated_at
BEFORE UPDATE ON wishlist
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE wishlist IS 'Stores products that buyers have added to their wishlist';

-- Add comments to columns
COMMENT ON COLUMN wishlist.buyer_id IS 'Reference to the buyer who added the product to their wishlist';
COMMENT ON COLUMN wishlist.product_id IS 'Reference to the product that was added to the wishlist';
