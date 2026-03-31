-- 1. Accelerate product management and public listings
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON products(seller_id, status);

-- 2. Accelerate order management (Seller & Buyer Dashboards)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON product_orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON product_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON product_orders(payment_reference);

-- 3. Accelerate withdrawal history and tracking
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_status ON withdrawal_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_ref ON withdrawal_requests(provider_reference);

-- 4. Accelerate order item retrieval
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 5. Accelerate user lookup by role and status
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, is_active);

-- 6. Case-insensitive shop name search (Slug optimization)
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name_lower ON sellers(LOWER(shop_name));
