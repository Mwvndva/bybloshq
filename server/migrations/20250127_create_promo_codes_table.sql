-- Migration: Create promo_codes table for event discounts
-- Allows organizers to create discount codes for their events

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
    used_count INTEGER DEFAULT 0 NOT NULL,
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0, -- Minimum order amount to use this code
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_code UNIQUE (event_id, code),
    CONSTRAINT valid_discount_percentage CHECK (
        discount_type = 'percentage' AND discount_value <= 100 AND discount_value > 0
        OR discount_type = 'fixed'
    ),
    CONSTRAINT valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Create promo_code_uses table to track individual uses
CREATE TABLE IF NOT EXISTS promo_code_uses (
    id SERIAL PRIMARY KEY,
    promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_promo_codes_event_id ON promo_codes(event_id);
CREATE INDEX idx_promo_codes_organizer_id ON promo_codes(organizer_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active, valid_from, valid_until);
CREATE INDEX idx_promo_code_uses_promo_code_id ON promo_code_uses(promo_code_id);
CREATE INDEX idx_promo_code_uses_ticket_id ON promo_code_uses(ticket_id);
CREATE INDEX idx_promo_code_uses_customer_email ON promo_code_uses(customer_email);

-- Add updated_at trigger
CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON promo_codes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the table
COMMENT ON TABLE promo_codes IS 'Promotional discount codes for events';
COMMENT ON COLUMN promo_codes.discount_type IS 'Type of discount: percentage or fixed amount';
COMMENT ON COLUMN promo_codes.discount_value IS 'Discount value (percentage 0-100 or fixed amount)';
COMMENT ON COLUMN promo_codes.max_uses IS 'Maximum number of times this code can be used (NULL = unlimited)';
COMMENT ON COLUMN promo_codes.used_count IS 'Number of times this code has been used';

