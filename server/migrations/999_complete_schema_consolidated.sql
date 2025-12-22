-- 999_complete_schema_consolidated.sql
-- Complete consolidated schema for Byblos platform
-- This file contains all tables, enums, indexes, triggers, and functions
-- Generated from analyzing all migration files

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$
BEGIN
    -- Product status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('draft', 'available', 'sold');
    END IF;
    
    -- Ticket status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
    END IF;
    
    -- Event status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
    END IF;
    
    -- User status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');
    END IF;
    
    -- Product type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE product_type AS ENUM ('physical', 'digital', 'service');
    END IF;

    -- Order status enum (with delivery flow)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED',
            'DELIVERY_PENDING', 'DELIVERY_COMPLETE', 'SERVICE_PENDING'
        );
    ELSE
        -- Add SERVICE_PENDING to existing enum if not present
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SERVICE_PENDING';
    END IF;
    
    -- Payment status enum (aligned with Paystack)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'reversed', 'completed');
    END IF;
    
    -- Payment method enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank');
    END IF;
    
    -- Payout status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    event_short_name VARCHAR(10);
    ticket_seq INTEGER;
BEGIN
    -- Get event short name (first 3 characters of event name, uppercase, no spaces)
    SELECT UPPER(REPLACE(SUBSTRING(name, 1, 3), ' ', '')) INTO event_short_name
    FROM events WHERE id = NEW.event_id;
    
    -- Get next sequence number for this event
    SELECT COALESCE(MAX(SUBSTRING(ticket_number, '\d+$')::INTEGER), 0) + 1 INTO ticket_seq
    FROM tickets
    WHERE event_id = NEW.event_id;
    
    -- Set the ticket number
    NEW.ticket_number := CONCAT('TKT-', event_short_name, '-', LPAD(ticket_seq::TEXT, 6, '0'));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Function to update order status history
CREATE OR REPLACE FUNCTION update_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO order_status_history (order_id, status, notes, created_by, created_by_type)
        VALUES (
            NEW.id, 
            NEW.status, 
            'Status changed from ' || COALESCE(OLD.status::TEXT, 'NULL') || ' to ' || NEW.status::TEXT,
            NULL, -- NULL created_by for system updates
            'system'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle order completion and payout creation
CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When order is marked as completed, update payment status to completed and create a payout record
    IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') THEN
        -- Update payment status to completed
        UPDATE product_orders 
        SET payment_status = 'completed',
            payment_completed_at = NOW()
        WHERE id = NEW.id;
        
        -- Create payout record
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
        WHERE NEW.seller_payout_amount > 0
        AND NOT EXISTS (
            SELECT 1 FROM payouts WHERE order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Sellers table
CREATE TABLE IF NOT EXISTS sellers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    store_name VARCHAR(255),
    shop_name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(60) GENERATED ALWAYS AS (LOWER(REPLACE(shop_name, ' ', '-'))) STORED UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    banner_image TEXT,
    theme VARCHAR(20) DEFAULT 'default',
    status user_status DEFAULT 'active' NOT NULL,
    balance DECIMAL(12, 2) DEFAULT 0,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    net_revenue DECIMAL(12, 2) DEFAULT 0,
    city VARCHAR(100),
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Organizers table
CREATE TABLE IF NOT EXISTS organizers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    status user_status DEFAULT 'active' NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE
);

-- Buyers table
CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password VARCHAR(255) NOT NULL,
    status user_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    city VARCHAR(100),
    location VARCHAR(100),
    refunds DECIMAL(12, 2) DEFAULT 0
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    location VARCHAR(255) NOT NULL,
    ticket_quantity INTEGER NOT NULL,
    ticket_price DECIMAL(10, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status event_status DEFAULT 'published' NOT NULL,
    tickets_sold INTEGER DEFAULT 0,
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Event ticket types table
CREATE TABLE IF NOT EXISTS event_ticket_types (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    available INTEGER,
    quantity_available INTEGER,
    max_per_order INTEGER DEFAULT 10,
    min_per_order INTEGER DEFAULT 1,
    sold INTEGER DEFAULT 0,
    sales_start_date TIMESTAMP WITH TIME ZONE,
    sales_end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_quantity CHECK (quantity >= 0),
    CONSTRAINT valid_price CHECK (price >= 0),
    CONSTRAINT valid_sales_period CHECK (sales_end_date IS NULL OR sales_start_date IS NULL OR sales_end_date > sales_start_date)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
    metadata JSONB,
    provider_reference VARCHAR(100),
    api_ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket purchases table
CREATE TABLE IF NOT EXISTS ticket_purchases (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_type_id INTEGER NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100),
    purchase_status VARCHAR(20) DEFAULT 'pending',
    discount_code VARCHAR(50),
    discount_amount DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    ticket_type_id INTEGER REFERENCES event_ticket_types(id) ON DELETE SET NULL,
    ticket_type_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status ticket_status DEFAULT 'pending' NOT NULL,
    scanned BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMP WITH TIME ZONE,
    unit_price DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    total_price DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    metadata JSONB,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    qr_code TEXT,
    purchase_id INTEGER REFERENCES ticket_purchases(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='purchase_id') THEN
        ALTER TABLE tickets ADD COLUMN purchase_id INTEGER REFERENCES ticket_purchases(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    status product_status DEFAULT 'draft' NOT NULL,
    aesthetic VARCHAR(50) DEFAULT 'noir' NOT NULL,
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_sold BOOLEAN DEFAULT FALSE,
    product_type product_type DEFAULT 'physical',
    service_locations TEXT,
    service_options JSONB,
    is_digital BOOLEAN DEFAULT FALSE,
    digital_file_path TEXT,
    digital_file_name TEXT,
    CONSTRAINT valid_price_positive CHECK (price >= 0)
);

-- Ensure columns exist even if table was already created
DO $$
BEGIN
    -- Product Type
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE product_type AS ENUM ('physical', 'digital', 'service');
    END IF;

    -- Add columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_type') THEN
        ALTER TABLE products ADD COLUMN product_type product_type DEFAULT 'physical';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='service_locations') THEN
        ALTER TABLE products ADD COLUMN service_locations TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='service_options') THEN
        ALTER TABLE products ADD COLUMN service_options JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_digital') THEN
        ALTER TABLE products ADD COLUMN is_digital BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='digital_file_path') THEN
        ALTER TABLE products ADD COLUMN digital_file_path TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='digital_file_name') THEN
        ALTER TABLE products ADD COLUMN digital_file_name TEXT;
    END IF;
END $$;

-- Product orders table
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
    cancelled_at TIMESTAMP WITH TIME ZONE,
    payment_completed_at TIMESTAMP WITH TIME ZONE
);

-- Order items table
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_subtotal_positive CHECK (subtotal >= 0)
);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    created_by INTEGER,
    created_by_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payouts table
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

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    mpesa_number VARCHAR(15) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(100),
    CONSTRAINT valid_mpesa_number CHECK (mpesa_number ~ '^[0-9]{10,15}$')
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, product_id)
);

-- Dashboard stats table
CREATE TABLE IF NOT EXISTS dashboard_stats (
    id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    total_events INTEGER NOT NULL DEFAULT 0,
    upcoming_events INTEGER NOT NULL DEFAULT 0,
    past_events INTEGER NOT NULL DEFAULT 0,
    current_events INTEGER NOT NULL DEFAULT 0,
    total_tickets_sold INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_attendees INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organizer_id)
);

-- Refund requests table
CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    order_id INTEGER,
    ticket_id INTEGER,
    amount DECIMAL(12, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by INTEGER REFERENCES organizers(id),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recent events table
CREATE TABLE IF NOT EXISTS recent_events (
    id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organizer_id, event_id)
);

-- Recent sales table
CREATE TABLE IF NOT EXISTS recent_sales (
    id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    transaction_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    ticket_type VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Sellers indexes
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name ON sellers(shop_name);
CREATE INDEX IF NOT EXISTS idx_sellers_slug ON sellers(slug);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_city ON sellers(city) WHERE city IS NOT NULL;

-- Organizers indexes
CREATE INDEX IF NOT EXISTS idx_organizers_email ON organizers(email);
CREATE INDEX IF NOT EXISTS idx_organizers_status ON organizers(status);

-- Buyers indexes
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);
CREATE INDEX IF NOT EXISTS idx_buyers_city ON buyers(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyers_location ON buyers(location) WHERE location IS NOT NULL;

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);

-- Event ticket types indexes
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON event_ticket_types(event_id);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_organizer ON tickets(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_purchase_id ON tickets(purchase_id);
CREATE INDEX IF NOT EXISTS idx_tickets_payment_id ON tickets(payment_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);

-- Ticket purchases indexes
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_event ON ticket_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_ticket_type ON ticket_purchases(ticket_type_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_aesthetic ON products(aesthetic);

-- Product orders indexes
CREATE INDEX IF NOT EXISTS idx_product_orders_order_number ON product_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_id ON product_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_id ON product_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_orders(status);
CREATE INDEX IF NOT EXISTS idx_product_orders_payment_status ON product_orders(payment_status);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Order status history indexes
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);

-- Payouts indexes
CREATE INDEX IF NOT EXISTS idx_payouts_seller_id ON payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON payouts(order_id);

-- Withdrawal requests indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_seller_id ON withdrawal_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_organizer_id ON payments(organizer_id);

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_buyer_id ON wishlist(buyer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- Dashboard stats indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_stats_organizer ON dashboard_stats(organizer_id);

-- Recent events indexes
CREATE INDEX IF NOT EXISTS idx_recent_events_organizer ON recent_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_recent_events_event ON recent_events(event_id);

-- Recent sales indexes
CREATE INDEX IF NOT EXISTS idx_recent_sales_organizer ON recent_sales(organizer_id);
CREATE INDEX IF NOT EXISTS idx_recent_sales_event ON recent_sales(event_id);

-- Refund requests indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_id ON refund_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested_at ON refund_requests(requested_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
-- Updated_at triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sellers_updated_at') THEN
        CREATE TRIGGER update_sellers_updated_at
        BEFORE UPDATE ON sellers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizers_updated_at') THEN
        CREATE TRIGGER update_organizers_updated_at
        BEFORE UPDATE ON organizers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_buyers_updated_at') THEN
        CREATE TRIGGER update_buyers_updated_at
        BEFORE UPDATE ON buyers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_events_updated_at') THEN
        CREATE TRIGGER update_events_updated_at
        BEFORE UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ticket_types_updated_at') THEN
        CREATE TRIGGER update_ticket_types_updated_at
        BEFORE UPDATE ON event_ticket_types
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tickets_updated_at') THEN
        CREATE TRIGGER update_tickets_updated_at
        BEFORE UPDATE ON tickets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
        CREATE TRIGGER update_products_updated_at
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_orders_updated_at') THEN
        CREATE TRIGGER update_product_orders_updated_at
        BEFORE UPDATE ON product_orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_items_updated_at') THEN
        CREATE TRIGGER update_order_items_updated_at
        BEFORE UPDATE ON order_items
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payouts_updated_at') THEN
        CREATE TRIGGER update_payouts_updated_at
        BEFORE UPDATE ON payouts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
        CREATE TRIGGER update_payments_updated_at
        BEFORE UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wishlist_updated_at') THEN
        CREATE TRIGGER update_wishlist_updated_at
        BEFORE UPDATE ON wishlist
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dashboard_stats_updated_at') THEN
        CREATE TRIGGER update_dashboard_stats_updated_at
        BEFORE UPDATE ON dashboard_stats
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_recent_sales_updated_at') THEN
        CREATE TRIGGER update_recent_sales_updated_at
        BEFORE UPDATE ON recent_sales
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Specialized triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'generate_ticket_number_trigger') THEN
        CREATE TRIGGER generate_ticket_number_trigger
        BEFORE INSERT ON tickets
        FOR EACH ROW
        WHEN (NEW.ticket_number IS NULL)
        EXECUTE FUNCTION generate_ticket_number();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'generate_order_number_trigger') THEN
        CREATE TRIGGER generate_order_number_trigger
        BEFORE INSERT ON product_orders
        FOR EACH ROW
        WHEN (NEW.order_number IS NULL)
        EXECUTE FUNCTION generate_order_number();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_order_status_history_trigger') THEN
        CREATE TRIGGER update_order_status_history_trigger
        AFTER UPDATE OF status ON product_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_order_status_history();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_order_completion_trigger') THEN
        CREATE TRIGGER handle_order_completion_trigger
        AFTER UPDATE OF status ON product_orders
        FOR EACH ROW
        WHEN (NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED')
        EXECUTE FUNCTION handle_order_completion();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_refund_requests_updated_at') THEN
        CREATE TRIGGER update_refund_requests_updated_at
        BEFORE UPDATE ON refund_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Add unique constraint for ticket numbers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_ticket_number_unique') THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_number_unique UNIQUE (ticket_number);
    END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_orders_amount_positive') THEN
        ALTER TABLE product_orders ADD CONSTRAINT chk_product_orders_amount_positive CHECK (total_amount >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_orders_platform_fee_positive') THEN
        ALTER TABLE product_orders ADD CONSTRAINT chk_product_orders_platform_fee_positive CHECK (platform_fee_amount >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_orders_payout_positive') THEN
        ALTER TABLE product_orders ADD CONSTRAINT chk_product_orders_payout_positive CHECK (seller_payout_amount >= 0);
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE order_status IS 'Order status enum supporting delivery flow: PENDING -> DELIVERY_PENDING -> DELIVERY_COMPLETE -> COMPLETED';
COMMENT ON TYPE payment_status IS 'Payment status enum: pending, paid, completed, failed, cancelled';

COMMENT ON TABLE sellers IS 'Table storing seller information including shop details';
COMMENT ON TABLE buyers IS 'Table storing buyer information';
COMMENT ON TABLE product_orders IS 'Table storing product orders with delivery flow support';
COMMENT ON TABLE order_status_history IS 'Tracks order status changes with audit trail';
COMMENT ON TABLE payouts IS 'Table storing seller payout information';
COMMENT ON TABLE withdrawal_requests IS 'Table storing seller withdrawal requests';
COMMENT ON TABLE wishlist IS 'Stores products that buyers have added to their wishlist';

-- ============================================================================
-- INITIAL DATA UPDATES (if needed)
-- ============================================================================

-- Update existing sellers with default shop names if needed
UPDATE sellers 
SET shop_name = 'shop-' || id 
WHERE shop_name IS NULL;

-- Update existing buyers with location defaults if needed
UPDATE buyers 
SET city = COALESCE(city, 'Nairobi'),
    location = COALESCE(location, 'CBD')
WHERE city IS NULL OR location IS NULL;

-- ============================================================================
-- SCHEMA UPDATES (Consolidated from separate migrations)
-- ============================================================================

-- Add digital product fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_path TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_file_name TEXT;

-- Add last_login to buyers
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_buyers_last_login ON buyers(last_login);

-- Add service columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type product_type DEFAULT 'physical';
ALTER TABLE products ADD COLUMN IF NOT EXISTS service_locations TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS service_options JSONB;

-- ============================================================================
-- COMPLETION LOG
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Complete schema migration executed successfully at %', NOW();
    RAISE NOTICE 'Tables created: sellers, organizers, buyers, events, event_ticket_types, tickets, ticket_purchases, products, product_orders, order_items, order_status_history, payouts, withdrawal_requests, payments, wishlist, dashboard_stats, recent_events, recent_sales';
    RAISE NOTICE 'Enums created: product_status, ticket_status, event_status, user_status, order_status, payment_status, payment_method, payout_status';
    RAISE NOTICE 'Functions created: update_updated_at_column, generate_ticket_number, generate_order_number, update_order_status_history, handle_order_completion';
    RAISE NOTICE 'Indexes and triggers created for all tables';
END $$;
