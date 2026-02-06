-- 20260206_add_client_orders_support.sql
-- Add support for seller-initiated client orders with dedicated clients table

-- ============================================================================
-- 1. CREATE CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Unique constraint: one client per seller+phone combination
    CONSTRAINT unique_seller_phone UNIQUE (seller_id, phone)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_seller_id ON clients(seller_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- ============================================================================
-- 2. UPDATE ORDER_STATUS ENUM
-- ============================================================================
-- Add 'CLIENT_PAYMENT_PENDING' to the order_status enum if it doesn't exist
DO $$
BEGIN
    -- Check if the value already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CLIENT_PAYMENT_PENDING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        ALTER TYPE order_status ADD VALUE 'CLIENT_PAYMENT_PENDING';
    END IF;
END $$;

-- ============================================================================
-- 3. ADD CLIENT-RELATED COLUMNS TO PRODUCT_ORDERS (if needed)
-- ============================================================================
-- Add client_id column to link orders to clients
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_orders' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE product_orders 
        ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add is_seller_initiated flag to distinguish seller-created orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_orders' AND column_name = 'is_seller_initiated'
    ) THEN
        ALTER TABLE product_orders 
        ADD COLUMN is_seller_initiated BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_product_orders_client_id ON product_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_initiated ON product_orders(is_seller_initiated) WHERE is_seller_initiated = TRUE;

-- ============================================================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE clients IS 'Stores client information for seller-initiated manual orders';
COMMENT ON COLUMN clients.seller_id IS 'The seller who manages this client';
COMMENT ON COLUMN clients.phone IS 'Client phone number for M-Pesa STK push';
COMMENT ON CONSTRAINT unique_seller_phone ON clients IS 'Prevents duplicate clients per seller';
COMMENT ON COLUMN product_orders.client_id IS 'References the client if this is a seller-initiated order';
COMMENT ON COLUMN product_orders.is_seller_initiated IS 'TRUE if order was created by seller for a client';
