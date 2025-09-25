-- Create orders table for PesaPal payments
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    merchant_reference VARCHAR(255) NOT NULL UNIQUE,
    order_tracking_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(100) DEFAULT 'pesapal',
    payment_reference VARCHAR(255) UNIQUE,
    payment_date TIMESTAMP WITH TIME ZONE,
    status_updated_by VARCHAR(255),
    
    -- Customer information
    customer_id VARCHAR(255),
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_first_name VARCHAR(100),
    customer_last_name VARCHAR(100),
    country_code VARCHAR(10) DEFAULT 'KE',
    
    -- Product information
    product_id VARCHAR(255),
    description TEXT,
    
    -- PesaPal specific fields
    callback_url TEXT,
    notification_id VARCHAR(255),
    ipn_notification_type VARCHAR(50),
    billing_address JSONB,
    
    -- Audit fields
    status_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE orders IS 'Stores order information for PesaPal payments';
COMMENT ON COLUMN orders.merchant_reference IS 'Unique reference for the order (ORD-{uuid})';
COMMENT ON COLUMN orders.order_tracking_id IS 'PesaPal order tracking ID';
COMMENT ON COLUMN orders.amount IS 'Order amount';
COMMENT ON COLUMN orders.currency IS 'Currency code (e.g., KES, USD)';
COMMENT ON COLUMN orders.status IS 'Order status (PENDING, COMPLETED, FAILED, etc.)';
COMMENT ON COLUMN orders.payment_status IS 'Payment status from PesaPal';
COMMENT ON COLUMN orders.payment_method IS 'Payment method used (e.g., PESAPAL, MPESA)';
COMMENT ON COLUMN orders.notification_id IS 'PesaPal IPN notification ID';

-- Create indexes
CREATE INDEX idx_orders_merchant_reference ON orders(merchant_reference);
CREATE INDEX idx_orders_order_tracking_id ON orders(order_tracking_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status_updated_at ON orders(status_updated_at);