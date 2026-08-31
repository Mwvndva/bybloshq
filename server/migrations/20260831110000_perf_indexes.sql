-- Migration: performance indexing.
--
-- 1) Add a functional index for the HOT payment->order lookup. The buyer's
--    order-status poll (public.getOrderStatus -> publicOrderStatus.repository) and
--    the reconciliation / fulfillment-retry paths join payments on
--    `metadata->>'order_id'`, which was a full Seq Scan of payments on every call.
--    (On a very large payments table, build this CONCURRENTLY out-of-band instead
--    to avoid the brief write lock: CREATE INDEX CONCURRENTLY ...)
CREATE INDEX IF NOT EXISTS idx_payments_metadata_order_id
    ON public.payments ((metadata->>'order_id'));

-- 2) Drop redundant duplicate indexes (each is fully covered by another index),
--    cutting per-write index-maintenance overhead on hot tables.
DROP INDEX IF EXISTS public.idx_products_seller;             -- duplicate of idx_products_seller_id (seller_id)
DROP INDEX IF EXISTS public.idx_users_email;                 -- covered by users_email_key (UNIQUE on email)
DROP INDEX IF EXISTS public.idx_product_orders_order_number; -- covered by product_orders_order_number_key (UNIQUE)
