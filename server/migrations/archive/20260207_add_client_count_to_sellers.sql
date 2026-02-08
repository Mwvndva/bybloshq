-- Add client_count column to sellers table
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS client_count INTEGER DEFAULT 0;

-- Create seller_clients table to track unique relationships
CREATE TABLE IF NOT EXISTS seller_clients (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_seller_clients_seller_id ON seller_clients(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_clients_user_id ON seller_clients(user_id);
