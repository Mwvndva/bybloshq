-- Performance Optimization Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_provider_ref ON payments(provider_reference);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id ON payments((metadata->>'order_id'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_seller_id_status ON product_orders(seller_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawal_seller_status ON withdrawal_requests(seller_id, status);
