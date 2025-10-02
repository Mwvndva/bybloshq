-- Ensure payment_method enum exists with correct values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank');
    END IF;
    
    -- Use existing payment_status enum values
    -- The values are: pending, completed, failed, cancelled
    
    -- Create payout_status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- Create product_orders table
CREATE TABLE IF NOT EXISTS product_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2) NOT NULL,
    platform_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    seller_payout_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status order_status DEFAULT 'PENDING' NOT NULL,
    payment_status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method,
    payment_reference VARCHAR(100),
    buyer_name VARCHAR(255) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(50) NOT NULL,
    shipping_address JSONB,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    product_price DECIMAL(12, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal DECIMAL(12, 2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    status payout_status DEFAULT 'pending' NOT NULL,
    reference_number VARCHAR(100) UNIQUE,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    created_by INTEGER, -- References buyer_id or seller_id depending on who made the change
    created_by_type VARCHAR(20), -- 'buyer', 'seller', 'admin', or 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_product_orders_order_number ON product_orders(order_number);
CREATE INDEX idx_product_orders_buyer_id ON product_orders(buyer_id);
CREATE INDEX idx_product_orders_seller_id ON product_orders(seller_id);
CREATE INDEX idx_product_orders_status ON product_orders(status);
CREATE INDEX idx_product_orders_payment_status ON product_orders(payment_status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_payouts_seller_id ON payouts(seller_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Add triggers for updated_at
CREATE TRIGGER update_product_orders_updated_at
BEFORE UPDATE ON product_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON payouts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    order_seq INTEGER;
    order_prefix VARCHAR(10) := 'ORD';
    order_date VARCHAR(8) := TO_CHAR(NOW(), 'YYYYMMDD');
BEGIN
    -- Get next sequence number for orders on this date
    SELECT COALESCE(MAX(SUBSTRING(order_number, 18)::INTEGER), 0) + 1 INTO order_seq
    FROM product_orders
    WHERE order_number LIKE order_prefix || '-' || order_date || '-%';
    
    -- Set the order number
    NEW.order_number := order_prefix || '-' || order_date || '-' || LPAD(order_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate order number before insert
CREATE TRIGGER generate_order_number_trigger
BEFORE INSERT ON product_orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION generate_order_number();

-- Function to update order status history
CREATE OR REPLACE FUNCTION update_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, status, created_by)
        VALUES (NEW.id, NEW.status, NULL); -- NULL created_by for system updates
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order status history
CREATE TRIGGER update_order_status_history_trigger
AFTER UPDATE OF status ON product_orders
FOR EACH ROW
EXECUTE FUNCTION update_order_status_history();

-- Function to handle order completion and payout creation
CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When order is marked as completed, create a payout record after 24 hours
    IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') THEN
        INSERT INTO payouts (
            order_id,
            seller_id,
            amount,
            status,
            payment_method,
            reference_number,
            created_at,
            updated_at
        )
        SELECT 
            NEW.id,
            NEW.seller_id,
            NEW.seller_payout_amount,
            'pending',
            'mpesa', -- Default payment method, can be updated later
            'PYT-' || NEW.order_number,
            NOW(),
            NOW()
        WHERE NEW.seller_payout_amount > 0;
        
        -- Schedule the payout to be processed after 24 hours
        PERFORM pg_notify('payout_scheduled', json_build_object(
            'order_id', NEW.id,
            'payout_time', (NOW() + INTERVAL '24 hours')::TEXT
        )::TEXT);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle order completion
CREATE TRIGGER handle_order_completion_trigger
AFTER UPDATE OF status ON product_orders
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED')
EXECUTE FUNCTION handle_order_completion();

-- Function to process scheduled payouts
CREATE OR REPLACE FUNCTION process_scheduled_payouts()
RETURNS void AS $$
BEGIN
    -- Update payouts that are pending and their order's delivered_at is older than 24 hours
    UPDATE payouts p
    SET 
        status = 'processing',
        updated_at = NOW()
    FROM product_orders o
    WHERE p.order_id = o.id
    AND p.status = 'pending'
    AND o.status = 'delivered'
    AND o.updated_at < (NOW() - INTERVAL '24 hours')
    RETURNING p.*;
    
    -- Here you would add the actual payout processing logic
    -- For example, calling the payment provider's API to initiate the transfer
    -- For now, we'll just mark them as completed after a short delay
    
    -- Simulate processing delay
    PERFORM pg_sleep(5);
    
    -- Mark payouts as completed
    UPDATE payouts
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE status = 'processing';
    
    -- Update the order status to completed
    UPDATE product_orders o
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    FROM payouts p
    WHERE o.id = p.order_id
    AND p.status = 'completed'
    AND o.status = 'delivered';
END;
$$ LANGUAGE plpgsql;
