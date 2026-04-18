-- Byblos Backend Performance Indexes
-- Applied as part of the backend remediation plan

-- Optimize public product catalog filtering by aesthetic and status
CREATE INDEX IF NOT EXISTS idx_products_aesthetic_status_seller 
ON products (aesthetic, status, seller_id) 
WHERE status = 'available';

-- Optimize buyer order history queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created 
ON product_orders (buyer_id, created_at DESC);

-- Optimize seller dashboard and order management
CREATE INDEX IF NOT EXISTS idx_orders_seller_status 
ON product_orders (seller_id, status);

-- Optimize pending registration lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_pending_reg_email_expiry 
ON pending_registrations (email, expires_at);

-- Optimize user lookups by email (already has unique constraint, but lowering for performance)
CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON users (LOWER(email));
