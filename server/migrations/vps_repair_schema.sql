-- BYBLOS FINTECH HARDENING & LOGISTICS REPAIR SCRIPT
-- This script safely adds missing enums, columns, and tables without affecting existing data.

-- 1. Create Enums if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN 
        CREATE TYPE order_type AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL'); 
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN 
        CREATE TYPE fulfillment_type AS ENUM ('BUYER_TO_SELLER', 'COURIER', 'SELLER_TO_BUYER', 'DIGITAL'); 
    END IF; 
END $$;

-- 2. Add values to existing order_status enum
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in some Postgres versions.
-- Run these separately if they fail in a transaction.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RESERVED' AFTER 'PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED';

-- 3. Update product_orders table
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS order_type order_type NOT NULL DEFAULT 'PHYSICAL';
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS fulfillment_type fulfillment_type NOT NULL DEFAULT 'BUYER_TO_SELLER';
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS delivery_location jsonb;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS total_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS reservation_expires_at timestamp with time zone;

-- 4. Update products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;

-- 5. Create service_slots table
CREATE TABLE IF NOT EXISTS service_slots (
    id SERIAL PRIMARY KEY,
    service_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    time_slot timestamp with time zone NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'AVAILABLE',
    reserved_by_order_id integer REFERENCES product_orders(id) ON DELETE SET NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_service_slot UNIQUE (service_id, time_slot)
);

-- 6. Create user_digital_access table
CREATE TABLE IF NOT EXISTS user_digital_access (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id integer NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    granted_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_product_access UNIQUE (user_id, product_id)
);

-- 7. Indices for Performance
CREATE INDEX IF NOT EXISTS idx_service_slots_service_id ON service_slots(service_id);
CREATE INDEX IF NOT EXISTS idx_user_digital_access_user_id ON user_digital_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_digital_access_product_id ON user_digital_access(product_id);
