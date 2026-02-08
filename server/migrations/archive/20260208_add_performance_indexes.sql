-- ==============================================
-- Critical Database Performance Indexes (Simplified)
-- ==============================================
-- This migration adds essential indexes for payment processing
-- Only includes indexes for columns that exist in the current schema
--
-- NOTE: Run this migration first, then add additional indexes
-- as needed based on your specific schema

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

-- Event ID lookup (event ticket payments) - if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'event_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_payments_event_id 
        ON payments(event_id) 
        WHERE event_id IS NOT NULL;
        RAISE NOTICE 'Created index on payments.event_id';
    END IF;
END $$;

-- ==============================================
-- 2. Withdrawal Requests Indexes (Payout Processing)
-- ==============================================

-- Provider reference lookup (webhook processing)
CREATE INDEX IF NOT EXISTS idx_withdrawals_provider_ref 
ON withdrawal_requests(provider_reference) 
WHERE provider_reference IS NOT NULL;

-- Seller withdrawals with status
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'withdrawal_requests' AND column_name = 'seller_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_status 
        ON withdrawal_requests(seller_id, status, created_at DESC);
        RAISE NOTICE 'Created index on withdrawal_requests(seller_id, status)';
    END IF;
END $$;

-- ==============================================
-- 3. User Lookup Indexes
-- ==============================================

-- Sellers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sellers') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'email') THEN
            CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
        END IF;
        
        RAISE NOTICE 'Created indexes for sellers table';
    END IF;
END $$;

-- Buyers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buyers') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON buyers(user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'email') THEN
            CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);
        END IF;
        
        RAISE NOTICE 'Created indexes for buyers table';
    END IF;
END $$;

-- Organizers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizers') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizers' AND column_name = 'user_id') THEN
            CREATE INDEX IF NOT EXISTS idx_organizers_user_id ON organizers(user_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizers' AND column_name = 'email') THEN
            CREATE INDEX IF NOT EXISTS idx_organizers_email ON organizers(email);
        END IF;
        
        RAISE NOTICE 'Created indexes for organizers table';
    END IF;
END $$;

-- ==============================================
-- 4. RBAC Performance Indexes
-- ==============================================

-- User roles lookup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
        RAISE NOTICE 'Created indexes for user_roles table';
    END IF;
END $$;

-- Role permissions lookup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
        CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
        CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
        RAISE NOTICE 'Created indexes for role_permissions table';
    END IF;
END $$;

-- ==============================================
-- Verification
-- ==============================================

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
    RAISE NOTICE 'Total indexes with idx_ prefix: %', index_count;
    RAISE NOTICE '';
END $$;
