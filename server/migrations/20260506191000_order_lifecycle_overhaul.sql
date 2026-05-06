-- Migration: Order Lifecycle Overhaul
-- Reason: Restructure order statuses and add inventory/digital delivery tracking.

-- 1. Enum synchronization moved to 20260506170000_re_sync_order_status.sql
-- (Required because ADD VALUE cannot be used in the same transaction as CREATE INDEX WHERE ...)

-- 2. Enhance Products Table (Atomic Inventory)
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;

-- 3. Add Hard Constraints (Safety Barriers)
ALTER TABLE products DROP CONSTRAINT IF EXISTS check_quantity_positive;
ALTER TABLE products ADD CONSTRAINT check_quantity_positive CHECK (quantity >= 0);

ALTER TABLE products DROP CONSTRAINT IF EXISTS check_reserved_quantity_positive;
ALTER TABLE products ADD CONSTRAINT check_reserved_quantity_positive CHECK (reserved_quantity >= 0);

-- 4. Digital Access Table
CREATE TABLE IF NOT EXISTS digital_access (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Issue Tracking
CREATE TABLE IF NOT EXISTS system_issues (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE SET NULL,
    issue_type VARCHAR(50) NOT NULL, -- 'LATE_PAYMENT', 'FULFILLMENT_FAILURE', 'INVENTORY_MISMATCH'
    severity VARCHAR(20) DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    resolved BOOLEAN DEFAULT FALSE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Fulfillment Queue
CREATE TABLE IF NOT EXISTS fulfillment_jobs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Indexes for Reconciliation and Queue performance
CREATE INDEX IF NOT EXISTS idx_product_orders_status_recon ON product_orders(status) WHERE status IN ('PAID', 'FULFILLMENT_PENDING', 'RESERVED', 'HELD');
CREATE INDEX IF NOT EXISTS idx_digital_access_order_id ON digital_access(order_id);
CREATE INDEX IF NOT EXISTS idx_system_issues_resolved ON system_issues(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_status_attempts ON fulfillment_jobs(status, attempts) WHERE status = 'PENDING' OR status = 'FAILED';
