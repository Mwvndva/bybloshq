-- BYBLOS BACKEND HARDENING: AUTH & REFUND PERFORMANCE
-- Date: 2026-04-02

-- 1. AUTH PERFORMANCE: Optimize RBAC lookups
-- Every request checks permissions; these indexes ensure O(log N) lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_slug ON permissions(slug);

-- 2. AUTH SECURITY: Password Change Enforcement
-- This column is already present in some versions; ensure it exists and has an index
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_changed_at') THEN
        ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_password_changed ON users(password_changed_at);

-- 3. REFUND PERFORMANCE: Optimize buyer refund history and status filtering
CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer_status ON refund_requests(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested_at ON refund_requests(requested_at DESC);

-- 4. ORDER PERFORMANCE: Optimize digital product lookups
CREATE INDEX IF NOT EXISTS idx_orders_digital_download ON orders(id, status) WHERE status = 'COMPLETED';

-- 5. CLEANUP: Standardize role slugs
UPDATE roles SET slug = LOWER(slug) WHERE slug != LOWER(slug);
