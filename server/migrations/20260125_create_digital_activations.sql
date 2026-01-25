-- Migration to create digital_activations table for .BYBX system
CREATE TABLE IF NOT EXISTS digital_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    master_key TEXT NOT NULL, -- The AES-256 key for this specific purchase
    hardware_binding_id VARCHAR(64), -- The hardware fingerprint (populated on activation)
    activated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, product_id)
);

-- Index for fast lookup during activation
CREATE INDEX IF NOT EXISTS idx_digital_activations_order_product ON digital_activations(order_id, product_id);
