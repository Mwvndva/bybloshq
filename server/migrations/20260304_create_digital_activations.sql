CREATE TABLE IF NOT EXISTS digital_activations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  master_key TEXT NOT NULL,
  hardware_binding_id VARCHAR(255),
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_digital_activations_order_product
  ON digital_activations(order_id, product_id);
