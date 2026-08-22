CREATE TABLE IF NOT EXISTS seller_knocks (
  id BIGSERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_knocks_seller_recent
  ON seller_knocks(seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_knocks_created_at
  ON seller_knocks(created_at);
