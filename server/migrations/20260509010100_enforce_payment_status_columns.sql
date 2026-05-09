-- Enforce payment status columns against the shared runtime enum.
-- This runs after 20260509010000 so new enum labels are committed before use.

DO $$
DECLARE
    invalid_values TEXT[];
BEGIN
    SELECT array_agg(DISTINCT status::text)
      INTO invalid_values
      FROM public.payments
     WHERE status IS NOT NULL
       AND status::text NOT IN (
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

    IF invalid_values IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot convert payments.status to payment_status; invalid values: %', invalid_values;
    END IF;
END $$;

DO $$
DECLARE
    invalid_values TEXT[];
BEGIN
    SELECT array_agg(DISTINCT payment_status::text)
      INTO invalid_values
      FROM public.product_orders
     WHERE payment_status IS NOT NULL
       AND payment_status::text NOT IN (
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

    IF invalid_values IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot convert product_orders.payment_status to payment_status; invalid values: %', invalid_values;
    END IF;
END $$;

DO $$
DECLARE
    column_type TEXT;
BEGIN
    SELECT udt_name
      INTO column_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'payments'
       AND column_name = 'status';

    IF column_type IS NOT NULL AND column_type <> 'payment_status' THEN
        ALTER TABLE public.payments
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE public.payment_status USING status::text::public.payment_status;
    END IF;

    IF column_type IS NOT NULL THEN
        ALTER TABLE public.payments
            ALTER COLUMN status SET DEFAULT 'pending'::public.payment_status;
    END IF;
END $$;

DO $$
DECLARE
    column_type TEXT;
BEGIN
    SELECT udt_name
      INTO column_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'product_orders'
       AND column_name = 'payment_status';

    IF column_type IS NOT NULL AND column_type <> 'payment_status' THEN
        ALTER TABLE public.product_orders
            ALTER COLUMN payment_status DROP DEFAULT,
            ALTER COLUMN payment_status TYPE public.payment_status USING payment_status::text::public.payment_status;
    END IF;

    IF column_type IS NOT NULL THEN
        ALTER TABLE public.product_orders
            ALTER COLUMN payment_status SET DEFAULT 'pending'::public.payment_status;
    END IF;
END $$;
