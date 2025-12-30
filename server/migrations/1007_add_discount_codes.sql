-- 1007_add_discount_codes.sql

-- Discount Codes table
CREATE TABLE IF NOT EXISTS discount_codes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES organizers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Discount Code Usage table
CREATE TABLE IF NOT EXISTS discount_code_usage (
    id SERIAL PRIMARY KEY,
    discount_code_id INTEGER NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    order_id INTEGER, -- Can be linked to product_orders or ticket_purchases
    discount_amount DECIMAL(10, 2) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_event_id ON discount_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_validity ON discount_codes(valid_from, valid_until, is_active);

CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_id ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_email ON discount_code_usage(customer_email);

-- Triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_discount_codes_updated_at') THEN
        CREATE TRIGGER update_discount_codes_updated_at
        BEFORE UPDATE ON discount_codes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
