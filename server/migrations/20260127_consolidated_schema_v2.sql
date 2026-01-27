-- 20260127_consolidated_schema_v2.sql
-- COMPLETE CONSOLIDATED SCHEMA V2
-- This file defines the entire database structure in its final desired state.
-- It is idempotent (safe to run on existing DBs).

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
            'DELIVERY_PENDING', 'DELIVERY_COMPLETE', 'SERVICE_PENDING', 'CONFIRMED', 'COLLECTION_PENDING'
        );
    ELSE
         -- Ensure new values exist
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'SERVICE_PENDING';
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'COLLECTION_PENDING';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'reversed', 'completed', 'cancelled');
    ELSE
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';
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

-- Users Table (Unified Auth)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('buyer', 'seller', 'organizer', 'admin')), -- Legacy role column, referenced by RBAC migration
    is_verified BOOLEAN DEFAULT FALSE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC: Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC: Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC: Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- RBAC: User Roles
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
    user_id INTEGER REFERENCES users(id), -- Link to unified user
    full_name VARCHAR(255),
    email VARCHAR(255),
    whatsapp_number VARCHAR(50), -- Renamed from phone
    password VARCHAR(255), -- Nullable for profile-only users
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
    instagram_link VARCHAR(255),
    physical_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Organizers
CREATE TABLE IF NOT EXISTS organizers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(50), -- Renamed from phone
    password VARCHAR(255),
    status user_status DEFAULT 'active' NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    balance DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE
);

-- Buyers
CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_payment VARCHAR(50), -- Renamed/Split from phone
    whatsapp_number VARCHAR(50), -- Renamed/Split from phone
    password VARCHAR(255),
    status user_status DEFAULT 'active' NOT NULL,
    city VARCHAR(100),
    location VARCHAR(100),
    refunds DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 4. COMMERCE TABLES (Products, Events, Orders)
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
    product_type product_type DEFAULT 'physical' NOT NULL, -- Enforced NOT NULL
    service_locations TEXT,
    service_options JSONB,
    is_digital BOOLEAN DEFAULT FALSE,
    digital_file_path TEXT,
    digital_file_name TEXT,
    CONSTRAINT valid_price_positive CHECK (price >= 0)
);

-- Orders
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
    buyer_mobile_payment VARCHAR(50), -- Renamed
    buyer_whatsapp_number VARCHAR(50), -- Added
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
-- 5. TICKETING & PAYMENTS
-- ============================================================================

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    status payment_status DEFAULT 'pending' NOT NULL,
    payment_method payment_method NOT NULL,
    mobile_payment VARCHAR(20), -- Renamed
    whatsapp_number VARCHAR(50), -- Added
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
    whatsapp_number VARCHAR(50), -- Renamed
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
    whatsapp_number VARCHAR(50), -- Added
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
-- 6. UTILITY TABLES (Payouts, Wishlist, Stats)
-- ============================================================================

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

CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, product_id)
);

-- ============================================================================
-- 7. SEEDING & DATA FIXES
-- ============================================================================

-- Insert permissions if not exist
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

-- Insert roles if not exist
INSERT INTO roles (name, slug) VALUES 
('Buyer', 'buyer'),
('Seller', 'seller'),
('Organizer', 'organizer'),
('Admin', 'admin')
ON CONFLICT (slug) DO NOTHING;

-- Link default permissions
DO $$
DECLARE
    role_buyer_id INTEGER := (SELECT id FROM roles WHERE slug = 'buyer');
    role_seller_id INTEGER := (SELECT id FROM roles WHERE slug = 'seller');
    role_organizer_id INTEGER := (SELECT id FROM roles WHERE slug = 'organizer');
    role_admin_id INTEGER := (SELECT id FROM roles WHERE slug = 'admin');
BEGIN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_buyer_id, id FROM permissions WHERE slug IN ('view-orders', 'manage-profile')
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_seller_id, id FROM permissions WHERE slug IN ('manage-products', 'request-payouts', 'manage-shop', 'view-orders', 'manage-profile')
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_organizer_id, id FROM permissions WHERE slug IN ('create-events', 'verify-tickets', 'view-analytics', 'manage-profile')
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT role_admin_id, id FROM permissions WHERE slug = 'manage-all'
    ON CONFLICT DO NOTHING;
END $$;
