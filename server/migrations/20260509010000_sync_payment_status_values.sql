-- Keep payment status storage aligned with all runtime statuses.
-- Runtime casts product_orders.payment_status through payment_status, and payments.status
-- stores the same finite runtime status set.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'payment_status'
    ) THEN
        CREATE TYPE public.payment_status AS ENUM (
            'pending',
            'completed',
            'failed',
            'cancelled',
            'success',
            'paid',
            'manual_review_required',
            'payment_mapping_failed',
            'compensation_required'
        );
    END IF;
END $$;

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'success';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'manual_review_required';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'payment_mapping_failed';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'compensation_required';
