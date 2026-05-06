-- BYBLOS MASTER MIGRATION SCRIPT
-- Consolidated: 2026-04-18
-- This script combines all migrations and base schema into one idempotent file.
-- Safely applies changes without deleting existing data.

-- ==========================================
-- 1. ENUMS & TYPES
-- ==========================================
DO $$ 
BEGIN 
            CREATE TYPE order_status AS ENUM ('PENDING', 'RESERVED', 'HELD', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'EXPIRED', 'COLLECTION_PENDING', 'DELIVERY_PENDING', 'SERVICE_PENDING'); 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN 
        CREATE TYPE order_type AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL'); 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN 
        CREATE TYPE fulfillment_type AS ENUM ('BUYER_TO_SELLER', 'COURIER', 'SELLER_TO_BUYER', 'DIGITAL'); 
    END IF; 
END $$;

-- Update existing enums for reserved/expired if not present
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'HELD';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FAILED';

-- ==========================================
-- 2. CORE SCHEMA SETUP
-- ==========================================

-- Roles & RBAC
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) REFERENCES roles(slug) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);

-- Sellers & Buyers
CREATE TABLE IF NOT EXISTS sellers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    shop_name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(50),
    city VARCHAR(100),
    location VARCHAR(255),
    physical_address TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    banner_image TEXT,
    theme VARCHAR(50),
    total_sales INTEGER DEFAULT 0,
    net_revenue NUMERIC(15, 2) DEFAULT 0,
    balance NUMERIC(15, 2) DEFAULT 0,
    client_count INTEGER DEFAULT 0,
    instagram_link TEXT,
    tiktok_link TEXT,
    facebook_link TEXT,
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile_payment VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(50),
    city VARCHAR(100),
    location VARCHAR(255),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    full_address TEXT,
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products & Inventory
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    description TEXT,
    image_url TEXT,
    images JSONB,
    aesthetic VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available',
    product_type VARCHAR(20) DEFAULT 'physical',
    is_digital BOOLEAN DEFAULT FALSE,
    digital_file_path TEXT,
    digital_file_name TEXT,
    digital_file_size INTEGER,
    service_locations JSONB,
    service_options JSONB,
    track_inventory BOOLEAN DEFAULT FALSE,
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders & Payments
CREATE TABLE IF NOT EXISTS product_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    platform_fee_amount NUMERIC(15, 2) NOT NULL,
    seller_payout_amount NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'payd',
    buyer_name VARCHAR(255),
    buyer_email VARCHAR(255),
    buyer_mobile_payment VARCHAR(50),
    buyer_whatsapp_number VARCHAR(50),
    shipping_address TEXT,
    notes TEXT,
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_status VARCHAR(20) DEFAULT 'pending',
    service_requirements TEXT,
    is_debt BOOLEAN DEFAULT FALSE,
    client_id INTEGER,
    is_seller_initiated BOOLEAN DEFAULT FALSE,
    fulfillment_type fulfillment_type DEFAULT 'BUYER_TO_SELLER',
    delivery_location JSONB,
    order_type order_type DEFAULT 'PHYSICAL',
    total_quantity INTEGER DEFAULT 1,
    reservation_expires_at TIMESTAMP WITH TIME ZONE,
    -- Unified Flat Columns Added via Migrations
    location_address TEXT,
    location_lat NUMERIC(10, 8),
    location_lng NUMERIC(11, 8),
    service_title TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KES',
    status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'payd',
    mobile_payment VARCHAR(50),
    whatsapp_number VARCHAR(50),
    email VARCHAR(255),
    metadata JSONB,
    provider_reference VARCHAR(255),
    api_ref VARCHAR(255),
    mpesa_receipt VARCHAR(50),
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Access & Extensions
CREATE TABLE IF NOT EXISTS service_slots (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    time_slot TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    reserved_by_order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_service_slot UNIQUE (service_id, time_slot)
);

CREATE TABLE IF NOT EXISTS user_digital_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_product_access UNIQUE (user_id, product_id)
);

-- ==========================================
-- 3. INCREMENTAL ENHANCEMENTS & BACKFILLS
-- ==========================================

-- Ensure recently added columns exist (Idempotent)
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10, 8);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS location_lng NUMERIC(11, 8);
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS service_title TEXT;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_slug ON permissions(slug);
CREATE INDEX IF NOT EXISTS idx_orders_notification_sent ON product_orders(notification_sent);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_service_slots_service_id ON service_slots(service_id);

-- Backfill flat columns for legacy orders (only if NULL)
UPDATE product_orders
SET 
  location_address = COALESCE(location_address, delivery_location->>'address', delivery_location->>'fullAddress', shipping_address::text, 'Not specified'),
  location_lat = COALESCE(location_lat, (delivery_location->>'lat')::numeric, (delivery_location->>'latitude')::numeric, 0),
  location_lng = COALESCE(location_lng, (delivery_location->>'lng')::numeric, (delivery_location->>'longitude')::numeric, 0),
  service_title = COALESCE(service_title, metadata->>'product_name', 'Service')
WHERE location_address IS NULL OR service_title IS NULL;

-- Standardize Roles Slugs
UPDATE roles SET slug = LOWER(slug) WHERE slug != LOWER(slug);
