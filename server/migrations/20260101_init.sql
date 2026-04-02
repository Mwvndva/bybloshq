-- 20260413_initial_consolidated_schema.sql
-- CONSOLIDATED INITIAL PRODUCTION SCHEMA
-- This file defines the entire database structure in its final desired state.
-- It combines all previous migrations (1-23) into a single idempotent baseline.

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('draft', 'available', 'sold');
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
            'COLLECTION_PENDING', 'CLIENT_PAYMENT_PENDING', 'DEBT_PENDING'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'reversed', 'completed', 'cancelled', 'paid', 'pending_debt');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'bank', 'debt');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END $$;

-- ============================================================================
-- 2. CORE AUTH TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('buyer', 'seller', 'admin', 'marketing')),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
    tiktok_link TEXT,
    facebook_link TEXT,
    physical_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    -- Referral Program
    referral_code VARCHAR(20) UNIQUE,
    referred_by_seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    referral_active_until TIMESTAMP WITH TIME ZONE,
    total_referral_earnings DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

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
    full_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    refunds DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. RELATIONSHIP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_seller_phone UNIQUE (seller_id, phone)
);

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

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    images JSONB DEFAULT '[]'::jsonb,
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

CREATE TABLE IF NOT EXISTS product_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    is_seller_initiated BOOLEAN DEFAULT FALSE,
    is_debt BOOLEAN DEFAULT FALSE,
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
    seller_dropoff_deadline TIMESTAMP WITH TIME ZONE,
    buyer_pickup_deadline TIMESTAMP WITH TIME ZONE,
    ready_for_pickup_at TIMESTAMP WITH TIME ZONE,
    auto_cancelled_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    payment_completed_at TIMESTAMP WITH TIME ZONE
);

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
-- 6. PAYMENTS & PAYOUTS
-- ============================================================================

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
    metadata JSONB,
    provider_reference VARCHAR(100),
    api_ref VARCHAR(100),
    raw_response JSONB,
    mpesa_receipt VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
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
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    mpesa_number VARCHAR(15) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider_reference VARCHAR(255) UNIQUE,
    raw_response JSONB,
    mpesa_receipt VARCHAR(50),
    api_call_pending BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(100)
);

-- ============================================================================
-- 7. FEATURE SPECIFIC TABLES
-- ============================================================================

-- Debt Feature
CREATE TABLE IF NOT EXISTS client_debts (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DRM / Digital Activations
CREATE TABLE IF NOT EXISTS digital_activations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  hardware_binding_id VARCHAR(255),
  session_token VARCHAR(32),
  session_expires_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP WITH TIME ZONE,
  bond_window_expires_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Referral Earnings
CREATE TABLE IF NOT EXISTS referral_earnings_log (
    id                  SERIAL PRIMARY KEY,
    referrer_seller_id  INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    referred_seller_id  INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    period_month        INTEGER NOT NULL,
    period_year         INTEGER NOT NULL,
    referred_gmv        DECIMAL(12,2) NOT NULL,
    reward_amount       DECIMAL(12,2) NOT NULL,
    credited_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_seller_id, referred_seller_id, period_month, period_year)
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

-- Refund Requests
CREATE TABLE IF NOT EXISTS refund_requests (
    id               SERIAL PRIMARY KEY,
    buyer_id         INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    amount           DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'rejected')),
    payment_method   VARCHAR(50) NOT NULL DEFAULT 'M-Pesa',
    payment_details  JSONB,
    requested_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at     TIMESTAMP WITH TIME ZONE,
    processed_by     INTEGER REFERENCES users(id),
    admin_notes      TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wishlists
CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, product_id)
);

-- ============================================================================
-- 8. INDEXES (Unified Suite)
-- ============================================================================

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_api_ref ON payments(api_ref);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_mobile_payment ON payments(mobile_payment);
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_receipt ON payments(mpesa_receipt);
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payments_fuzzy_match ON payments (status, mobile_payment) WHERE status = 'pending';

-- Withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref ON withdrawal_requests(provider_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_status ON withdrawal_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_mpesa_receipt ON withdrawal_requests(mpesa_receipt);

-- Orders
CREATE INDEX IF NOT EXISTS idx_product_orders_number ON product_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_id ON product_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_id ON product_orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_product_orders_client_id ON product_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON product_orders(payment_reference);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_products_inventory ON products(track_inventory, quantity) WHERE track_inventory = TRUE;

-- Sellers
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name ON sellers(shop_name);
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name_lower ON sellers(LOWER(shop_name));
CREATE INDEX IF NOT EXISTS idx_sellers_city_location ON sellers(city, location);
CREATE INDEX IF NOT EXISTS idx_sellers_referral_code ON sellers(referral_code) WHERE referral_code IS NOT NULL;

-- Payouts
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_order_id_unique ON payouts (order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_payment_id ON payouts(payment_id);

-- Miscellaneous
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_digital_activations_order_product ON digital_activations(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_digital_activations_session_token ON digital_activations(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_reviewed ON security_alerts(reviewed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer ON refund_requests (buyer_id, status);

-- ============================================================================
-- 9. SEED DATA (RBAC)
-- ============================================================================

-- Seed Permissions
INSERT INTO permissions (name, slug) VALUES 
('Manage Products', 'manage-products'),
('Request Payouts', 'request-payouts'),
('Manage Shop', 'manage-shop'),
('View Analytics', 'view-analytics'),
('View Orders', 'view-orders'),
 ('Manage Profile', 'manage-profile'),
('Super Admin Access', 'manage-all'),
('View Marketing Analytics', 'view-marketing')
ON CONFLICT (slug) DO NOTHING;

-- Seed Roles
INSERT INTO roles (name, slug) VALUES 
('Buyer', 'buyer'),
('Seller', 'seller'),
('Admin', 'admin'),
('Marketing Admin', 'marketing')
ON CONFLICT (slug) DO NOTHING;

-- Map Permissions
DO $$
DECLARE
    role_buyer_id INTEGER := (SELECT id FROM roles WHERE slug = 'buyer');
    role_seller_id INTEGER := (SELECT id FROM roles WHERE slug = 'seller');
    role_admin_id INTEGER := (SELECT id FROM roles WHERE slug = 'admin');
    role_marketing_id INTEGER := (SELECT id FROM roles WHERE slug = 'marketing');
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

    IF role_admin_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_admin_id, id FROM permissions WHERE slug = 'manage-all'
        ON CONFLICT DO NOTHING;
    END IF;

    IF role_marketing_id IS NOT NULL THEN
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_marketing_id, id FROM permissions WHERE slug = 'view-marketing'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
