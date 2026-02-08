-- 20260208_unified_schema_v3.sql
-- COMPLETE CONSOLIDATED UNIFIED SCHEMA V3
-- This file defines the entire database structure in its final desired state.
-- It is strictly idempotent and designed to bring a database from any state (even empty)
-- to the latest production-ready version with all enhancements and security fixes.

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENUMS (Updated with all latest values)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('draft', 'available', 'sold');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
        CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE product_type AS ENUM ('physical', 'digital', 'service');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED',
            'DELIVERY_PENDING', 'DELIVERY_COMPLETE', 'SERVICE_PENDING', 'CONFIRMED', 
            'COLLECTION_PENDING', 'CLIENT_PAYMENT_PENDING'
        );
    ELSE
         -- Ensure new values exist in existing enum
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SERVICE_PENDING';
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COLLECTION_PENDING';
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CLIENT_PAYMENT_PENDING';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'reversed', 'completed', 'cancelled', 'paid');
    ELSE
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- ============================================================================
-- 2. CORE AUTH TABLES (Users & RBAC)
-- ============================================================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('buyer', 'seller', 'organizer', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC tables
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================================
-- 3. PROFILE TABLES
-- ============================================================================

-- Sellers
CREATE TABLE IF NOT EXISTS sellers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255),
    email VARCHAR(255),
    whatsapp_number VARCHAR(50),
    store_name VARCHAR(255),
    shop_name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(100) GENERATED ALWAYS AS (LOWER(REPLACE(shop_name, ' ', '-'))) STORED UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    banner_image TEXT,
    theme VARCHAR(20) DEFAULT 'default',
    status user_status DEFAULT 'active' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    balance DECIMAL(12, 2) DEFAULT 0,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    net_revenue DECIMAL(12, 2) DEFAULT 0,
    client_count INTEGER DEFAULT 0,
    city VARCHAR(100),
    location VARCHAR(100),
    instagram_link VARCHAR(255),
    physical_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Organizers
CREATE TABLE IF NOT EXISTS organizers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(50),
    status user_status DEFAULT 'active' NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    balance DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Buyers
CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_payment VARCHAR(50),
    whatsapp_number VARCHAR(50),
    status user_status DEFAULT 'active' NOT NULL,
    city VARCHAR(100),
    location VARCHAR(100),
    refunds DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. NEW RELATIONSHIP TABLES
-- ============================================================================

-- Simple clients table (for manual orders)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_seller_phone UNIQUE (seller_id, phone)
);

-- Registered users who are clients of sellers
CREATE TABLE IF NOT EXISTS seller_clients (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, user_id)
);

-- ============================================================================
-- 5. COMMERCE TABLES
-- ============================================================================

-- Events
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
    balance DECIMAL(12, 2) DEFAULT 0,
    withdrawal_status VARCHAR(20) DEFAULT 'pending',
    withdrawal_date TIMESTAMP WITH TIME ZONE,
    withdrawal_amount DECIMAL(12, 2) DEFAULT 0,
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Products
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
    product_type product_type DEFAULT 'physical' NOT NULL,
    service_locations TEXT,
    service_options JSONB,
    is_digital BOOLEAN DEFAULT FALSE,
    digital_file_path TEXT,
    digital_file_name TEXT,
    -- Inventory Tracking
    track_inventory BOOLEAN DEFAULT FALSE,
    quantity INTEGER DEFAULT NULL,
    low_stock_threshold INTEGER DEFAULT 5,
    CONSTRAINT valid_price_positive CHECK (price >= 0),
    CONSTRAINT quantity_non_negative CHECK (quantity IS NULL OR quantity >= 0)
);

-- Product Orders
CREATE TABLE IF NOT EXISTS product_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL, -- For seller-initiated
    is_seller_initiated BOOLEAN DEFAULT FALSE,
    total_amount DECIMAL(12, 2) NOT NULL,
    platform_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    seller_payout_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status order_status DEFAULT 'PENDING' NOT NULL,
    payment_status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method,
    payment_reference VARCHAR(100),
    buyer_name VARCHAR(255) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_mobile_payment VARCHAR(50),
    buyer_whatsapp_number VARCHAR(50),
    shipping_address JSONB,
    service_requirements TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    payment_completed_at TIMESTAMP WITH TIME ZONE
);

-- Order Items
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

-- ============================================================================
-- 6. TICKETING & PAYMENTS
-- ============================================================================

-- General Payments (for tickets and orders)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method NOT NULL,
    mobile_payment VARCHAR(20),
    whatsapp_number VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
    metadata JSONB,
    provider_reference VARCHAR(100),
    api_ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event Ticket Types
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Purchases
CREATE TABLE IF NOT EXISTS ticket_purchases (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_type_id INTEGER NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(50),
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_reference VARCHAR(100),
    purchase_status VARCHAR(20) DEFAULT 'pending',
    discount_code VARCHAR(50),
    discount_amount DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id INTEGER NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(50),
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

-- ============================================================================
-- 7. UTILITY TABLES
-- ============================================================================

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) DEFAULT 0,
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

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    mpesa_number VARCHAR(15) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider_reference VARCHAR(255) UNIQUE,
    raw_response JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(100)
);

-- Rename wishlist to wishlists (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists') THEN
        ALTER TABLE wishlist RENAME TO wishlists;
    END IF;
END $$;

-- Ensure wishlists table exists
CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, product_id)
);

-- Security Monitoring
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(255) NOT NULL,
    details JSONB NOT NULL,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviewed_at_check CHECK (
        (reviewed = FALSE AND reviewed_at IS NULL) OR
        (reviewed = TRUE AND reviewed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(255),
    client_ip VARCHAR(45) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. INDEXES (Unified Performance Suite)
-- ============================================================================

-- General Payment Lookups
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON payments(provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_api_ref ON payments(api_ref);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_mobile_payment ON payments(mobile_payment);
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(created_at DESC) WHERE status = 'pending';

-- Withdrawal Lookups
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref ON withdrawal_requests(provider_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status, created_at DESC);

-- User Lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name ON sellers(shop_name);
CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_organizers_user_id ON organizers(user_id);

-- Profile Search
CREATE INDEX IF NOT EXISTS idx_sellers_city_location ON sellers(city, location);
CREATE INDEX IF NOT EXISTS idx_buyers_city_location ON buyers(city, location);

-- Order Performance
CREATE INDEX IF NOT EXISTS idx_product_orders_number ON product_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_id ON product_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_id ON product_orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_product_orders_client_id ON product_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_initiated ON product_orders(is_seller_initiated) WHERE is_seller_initiated = TRUE;

-- Product Discovery & Inventory
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_products_inventory ON products(track_inventory, quantity) WHERE track_inventory = TRUE;

-- Client Management
CREATE INDEX IF NOT EXISTS idx_seller_clients_seller_id ON seller_clients(seller_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);

-- Webhook Monitoring
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_reviewed ON security_alerts(reviewed, created_at DESC);

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    deleted BIGINT;
BEGIN
    DELETE FROM webhook_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. SEED DATA (Permissions, Roles, Admin)
-- ============================================================================

-- Seed Permissions
INSERT INTO permissions (name, slug) VALUES 
('Manage Products', 'manage-products'),
('Request Payouts', 'request-payouts'),
('Manage Shop', 'manage-shop'),
('Create Events', 'create-events'),
('Verify Tickets', 'verify-tickets'),
('View Analytics', 'view-analytics'),
('View Orders', 'view-orders'),
('Manage Profile', 'manage-profile'),
('Super Admin Access', 'manage-all')
ON CONFLICT (slug) DO NOTHING;

-- Seed Roles
INSERT INTO roles (name, slug) VALUES 
('Buyer', 'buyer'),
('Seller', 'seller'),
('Organizer', 'organizer'),
('Admin', 'admin')
ON CONFLICT (slug) DO NOTHING;

-- Map Permissions
DO $$
DECLARE
    role_buyer_id INTEGER := (SELECT id FROM roles WHERE slug = 'buyer');
    role_seller_id INTEGER := (SELECT id FROM roles WHERE slug = 'seller');
    role_organizer_id INTEGER := (SELECT id FROM roles WHERE slug = 'organizer');
    role_admin_id INTEGER := (SELECT id FROM roles WHERE slug = 'admin');
BEGIN
    IF role_buyer_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_buyer_id, id FROM permissions WHERE slug IN ('view-orders', 'manage-profile')
        ON CONFLICT DO NOTHING;
    END IF;

    IF role_seller_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_seller_id, id FROM permissions WHERE slug IN ('manage-products', 'request-payouts', 'manage-shop', 'view-orders', 'manage-profile')
        ON CONFLICT DO NOTHING;
    END IF;

    IF role_organizer_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_organizer_id, id FROM permissions WHERE slug IN ('create-events', 'verify-tickets', 'view-analytics', 'manage-profile')
        ON CONFLICT DO NOTHING;
    END IF;

    IF role_admin_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_admin_id, id FROM permissions WHERE slug = 'manage-all'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Create Admin User
DO $$
DECLARE
    admin_user_id INTEGER;
    admin_role_id INTEGER := (SELECT id FROM roles WHERE slug = 'admin');
    -- Password hash for '14253553805'
    hashed_password TEXT := '$2b$12$ohCGGI4Os2vVagYuaU4fRucG7S9G1Z3vrXZXBV0BGGkT9qxh6IDhu';
BEGIN
    INSERT INTO users (email, password_hash, role, is_verified, is_active)
    VALUES ('admin@bybloshq.space', hashed_password, 'admin', true, true)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = 'admin', updated_at = NOW()
    RETURNING id INTO admin_user_id;

    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM users WHERE email = 'admin@bybloshq.space';
    END IF;

    IF admin_role_id IS NOT NULL AND admin_user_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (admin_user_id, admin_role_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
