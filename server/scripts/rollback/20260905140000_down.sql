-- ROLLBACK for migrations/20260905140000_drop_legacy_order_completion_payout_trigger.sql
--
-- ⚠️  DANGER — DO NOT RUN THIS unless you are deliberately reverting the entire
-- escrow/settlement payout system to its pre-EscrowManager state.
--
-- This re-creates the legacy handle_order_completion_trigger EXACTLY as it was
-- (from 20250930150000_add_product_orders_tables.sql). That trigger silently
-- blocks EscrowManager from crediting seller escrow AND creator commission /
-- referral on EVERY order completion: it inserts an incomplete `payouts` row
-- first, which trips EscrowManager's `ON CONFLICT (order_id) DO NOTHING`
-- idempotency gate, so the real crediting never runs. Re-introducing it
-- re-introduces that production-breaking bug. In almost every situation you do
-- NOT want to roll this migration back.
--
-- Provided only so the migration has a true, documented inverse. Run with:
--   psql "$DATABASE_URL" -f scripts/rollback/20260905140000_down.sql

BEGIN;

CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND (OLD.status IS DISTINCT FROM 'COMPLETED') THEN
        INSERT INTO payouts (
            order_id,
            seller_id,
            amount,
            status,
            payment_method,
            reference_number,
            created_at,
            updated_at
        )
        SELECT
            NEW.id,
            NEW.seller_id,
            NEW.seller_payout_amount,
            'pending',
            'mpesa',
            'PYT-' || NEW.order_number,
            NOW(),
            NOW()
        WHERE NEW.seller_payout_amount > 0;

        PERFORM pg_notify('payout_scheduled', json_build_object(
            'order_id', NEW.id,
            'payout_time', (NOW() + INTERVAL '24 hours')::TEXT
        )::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_order_completion_trigger ON product_orders;
CREATE TRIGGER handle_order_completion_trigger
AFTER UPDATE OF status ON product_orders
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED')
EXECUTE FUNCTION handle_order_completion();

-- Un-record the migration so `npm run migrate` re-applies it (drops the trigger
-- again) on the next run.
DELETE FROM pgmigrations WHERE name = '20260905140000_drop_legacy_order_completion_payout_trigger';

COMMIT;
