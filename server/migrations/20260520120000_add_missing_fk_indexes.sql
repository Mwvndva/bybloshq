-- Migration: backfill missing foreign-key and hot-path indexes.
-- Folds in the standalone server/src/database/fix-indexes.sql (which lived
-- outside the migration pipeline and therefore did not run on fresh deploys),
-- and adds the FK indexes the audit identified as missing.
--
-- Note on locking: this migration runs inside node-pg-migrate's default
-- transaction, so CREATE INDEX CONCURRENTLY is not used. Each CREATE INDEX
-- takes a brief ShareLock on its table; run during a low-traffic window if
-- the target tables are large.

-- ----- Folded in from server/src/database/fix-indexes.sql -----

CREATE INDEX IF NOT EXISTS idx_products_aesthetic_status_seller
    ON products (aesthetic, status, seller_id)
    WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
    ON product_orders (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_status
    ON product_orders (seller_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_reg_email_expiry
    ON pending_registrations (email, expires_at);

CREATE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (LOWER(email));

-- ----- New FK indexes missing entirely from prior migrations -----

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_buyers_user_id
    ON buyers (user_id);

CREATE INDEX IF NOT EXISTS idx_sellers_user_id
    ON sellers (user_id);
