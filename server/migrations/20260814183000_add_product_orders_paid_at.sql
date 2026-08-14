-- Ensure logistics and order reporting queries can rely on product_orders.paid_at.
-- Some deployed databases were created before this column existed.

ALTER TABLE public.product_orders
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_product_orders_paid_at
    ON public.product_orders(paid_at);
