-- ==============================================
-- Critical Database Performance Indexes
-- ==============================================
-- This migration adds indexes to improve query performance
-- for payment processing, webhooks, and user lookups
--
-- NOTE: CONCURRENTLY keyword removed to allow migration within transaction block
-- For production deployment with zero downtime, run indexes manually with CONCURRENTLY
-- Example: CREATE INDEX idx_name ON table(column);

-- ==============================================
-- 1. Payment Processing Indexes (CRITICAL)
-- ==============================================

-- Provider reference lookup (webhook processing)
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference 
ON payments(provider_reference) 
WHERE provider_reference IS NOT NULL;

-- Invoice ID lookup
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
ON payments(invoice_id) 
WHERE invoice_id IS NOT NULL;

-- API reference lookup
CREATE INDEX IF NOT EXISTS idx_payments_api_ref 
ON payments(api_ref) 
WHERE api_ref IS NOT NULL;

-- Status and creation date (for pending payment queries)
CREATE INDEX IF NOT EXISTS idx_payments_status_created 
ON payments(status, created_at DESC);

-- Mobile payment lookup (fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_payments_mobile_payment 
ON payments(mobile_payment) 
WHERE mobile_payment IS NOT NULL;

-- Partial index for pending payments (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_payments_pending 
ON payments(created_at DESC, mobile_payment, amount) 
WHERE status = 'pending';

-- Buyer ID lookup (user payment history)
CREATE INDEX IF NOT EXISTS idx_payments_buyer_id 
ON payments(buyer_id) 
WHERE buyer_id IS NOT NULL;

-- Event ID lookup (event ticket payments)
CREATE INDEX IF NOT EXISTS idx_payments_event_id 
ON payments(event_id) 
WHERE event_id IS NOT NULL;

-- ==============================================
-- 2. Product Orders Indexes (Seller Dashboard)
-- ==============================================

-- Buyer orders lookup
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id 
ON product_orders(buyer_id);

-- Seller orders with status filter
CREATE INDEX IF NOT EXISTS idx_orders_seller_id_status 
ON product_orders(seller_id, status, created_at DESC);

-- Payment reference lookup
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref 
ON product_orders(payment_reference) 
WHERE payment_reference IS NOT NULL;

-- Order status tracking
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON product_orders(status, created_at DESC);

-- ==============================================
-- 3. Products Indexes (Shop Browsing)
-- ==============================================

-- Seller products with status
CREATE INDEX IF NOT EXISTS idx_products_seller_status 
ON products(seller_id, status, created_at DESC);

-- Active products only (most common query)
CREATE INDEX IF NOT EXISTS idx_products_active 
ON products(seller_id, created_at DESC) 
WHERE status = 'available';

-- Product category browsing
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category, created_at DESC) 
WHERE status = 'available';

-- ==============================================
-- 4. Tickets Indexes (Event Management)
-- ==============================================

-- Event tickets lookup
CREATE INDEX IF NOT EXISTS idx_tickets_event_id 
ON tickets(event_id);

-- Customer email lookup
CREATE INDEX IF NOT EXISTS idx_tickets_customer_email 
ON tickets(customer_email);

-- Ticket number lookup (QR code validation)
CREATE INDEX IF NOT EXISTS idx_tickets_number 
ON tickets(ticket_number);

-- Payment ID lookup
CREATE INDEX IF NOT EXISTS idx_tickets_payment_id 
ON tickets(payment_id) 
WHERE payment_id IS NOT NULL;

-- ==============================================
-- 5. Withdrawal Requests Indexes (Payout Processing)
-- ==============================================

-- Provider reference lookup (webhook processing)
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref 
ON withdrawal_requests(provider_reference) 
WHERE provider_reference IS NOT NULL;

-- Seller withdrawals with status
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_status 
ON withdrawal_requests(seller_id, status, created_at DESC);

-- Event withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_event_id 
ON withdrawal_requests(event_id) 
WHERE event_id IS NOT NULL;

-- Organizer withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_organizer_id 
ON withdrawal_requests(organizer_id) 
WHERE organizer_id IS NOT NULL;

-- ==============================================
-- 6. User Lookup Indexes
-- ==============================================

-- Sellers
CREATE INDEX IF NOT EXISTS idx_sellers_user_id 
ON sellers(user_id);

CREATE INDEX IF NOT EXISTS idx_sellers_email 
ON sellers(email);

CREATE INDEX IF NOT EXISTS idx_sellers_shop_name 
ON sellers(shop_name) 
WHERE shop_name IS NOT NULL;

-- Buyers
CREATE INDEX IF NOT EXISTS idx_buyers_user_id 
ON buyers(user_id);

CREATE INDEX IF NOT EXISTS idx_buyers_email 
ON buyers(email);

-- Organizers
CREATE INDEX IF NOT EXISTS idx_organizers_user_id 
ON organizers(user_id);

CREATE INDEX IF NOT EXISTS idx_organizers_email 
ON organizers(email);

-- ==============================================
-- 7. Events Indexes (Public Browsing)
-- ==============================================

-- Published events (public browsing)
CREATE INDEX IF NOT EXISTS idx_events_status_date 
ON events(status, event_date DESC) 
WHERE status = 'published';

-- Organizer events
CREATE INDEX IF NOT EXISTS idx_events_organizer_id 
ON events(organizer_id, created_at DESC);

-- Event category
CREATE INDEX IF NOT EXISTS idx_events_category 
ON events(category, event_date DESC) 
WHERE status = 'published';

-- ==============================================
-- 8. RBAC Performance Indexes
-- ==============================================

-- User roles lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id 
ON user_roles(role_id);

-- Role permissions lookup
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id 
ON role_permissions(role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id 
ON role_permissions(permission_id);

-- ==============================================
-- 9. Client Relationships (if table exists)
-- ==============================================

-- Client-seller relationships
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_seller_relationships') THEN
        CREATE INDEX IF NOT EXISTS idx_client_seller_buyer_id 
        ON client_seller_relationships(buyer_id);
        
        CREATE INDEX IF NOT EXISTS idx_client_seller_seller_id 
        ON client_seller_relationships(seller_id);
        
        RAISE NOTICE 'Created indexes for client_seller_relationships';
    END IF;
END $$;

-- ==============================================
-- 10. Verification Queries
-- ==============================================

-- Count indexes created
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Database performance indexes migration completed';
    RAISE NOTICE 'Total indexes created: %', index_count;
    RAISE NOTICE '';
    RAISE NOTICE '📊 To view all indexes:';
    RAISE NOTICE 'SELECT tablename, indexname FROM pg_indexes WHERE schemaname = ''public'' AND indexname LIKE ''idx_%%'' ORDER BY tablename;';
    RAISE NOTICE '';
    RAISE NOTICE '📊 To check index usage:';
    RAISE NOTICE 'SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = ''public'' ORDER BY idx_scan DESC;';
END $$;

-- List all created indexes
SELECT 
    tablename, 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
