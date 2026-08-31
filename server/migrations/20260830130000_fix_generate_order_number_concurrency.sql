-- Migration: Make order-number generation concurrency-safe and fix sequence parsing.
--
-- The previous generate_order_number() computed:
--   order_seq = MAX(SUBSTRING(order_number, 18)::int) + 1   (for today's ORD-YYYYMMDD- prefix)
-- which had two defects:
--   1) MAX+1 is NOT atomic. Two simultaneous checkouts computed the same sequence, so one
--      INSERT failed on the product_orders_order_number_key unique constraint — i.e. a failed
--      checkout for a real buyer under concurrent load.
--   2) The sequence starts at position 14 (ORD-=4, YYYYMMDD=8, -=1 => 13), so SUBSTRING(...,18)
--      only read the last TWO digits of the 6-digit sequence. Once a day passed 99 orders the
--      MAX was computed wrongly, producing collisions.
--
-- Fix: take a per-day transaction advisory lock to serialize generation (auto-released at
-- COMMIT, once the new row is durable and visible to the next waiter), and parse the full
-- sequence from position 14. Format is unchanged: ORD-YYYYMMDD-NNNNNN.

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    order_seq INTEGER;
    order_prefix VARCHAR(10) := 'ORD';
    order_date VARCHAR(8) := TO_CHAR(NOW(), 'YYYYMMDD');
BEGIN
    -- Serialize per-day order-number generation so MAX+1 is atomic under concurrent
    -- inserts. Transaction-scoped lock: released automatically at COMMIT, after this
    -- order row is committed and therefore visible to the next waiting transaction.
    PERFORM pg_advisory_xact_lock(hashtext('generate_order_number:' || order_date));

    SELECT COALESCE(MAX(SUBSTRING(order_number, 14)::INTEGER), 0) + 1 INTO order_seq
    FROM product_orders
    WHERE order_number LIKE order_prefix || '-' || order_date || '-%';

    NEW.order_number := order_prefix || '-' || order_date || '-' || LPAD(order_seq::TEXT, 6, '0');

    RETURN NEW;
END;
$function$;
