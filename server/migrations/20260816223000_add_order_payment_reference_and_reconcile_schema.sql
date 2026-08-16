-- Incremental Migration: Add missing payment_reference and reconcile schema drift
-- Ensures idempotent addition of columns referenced across models and services.

-- 1. Product Orders
ALTER TABLE public.product_orders
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_product_orders_payment_reference
    ON public.product_orders(payment_reference);

CREATE INDEX IF NOT EXISTS idx_product_orders_paid_at
    ON public.product_orders(paid_at);

-- 2. Products
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS customization_prompt TEXT,
    ADD COLUMN IF NOT EXISTS import_days INTEGER,
    ADD COLUMN IF NOT EXISTS import_note TEXT,
    ADD COLUMN IF NOT EXISTS production_days INTEGER;

-- 3. Sellers
ALTER TABLE public.sellers
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS referral_active_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS referred_by_seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS refund_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withdrawal_reserved_balance NUMERIC(15, 2) NOT NULL DEFAULT 0;
