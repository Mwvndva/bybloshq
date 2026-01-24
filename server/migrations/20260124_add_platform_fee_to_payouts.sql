-- 20260124_add_platform_fee_to_payouts.sql
-- Fix for EscrowManager fund release error

-- 1. Add platform_fee to payouts table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payouts' AND column_name='platform_fee') THEN
        ALTER TABLE payouts ADD COLUMN platform_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

-- 2. Update existing completed payouts to populate platform_fee from product_orders if possible
-- This is optional but good for data integrity for historical records
UPDATE payouts p
SET platform_fee = po.platform_fee_amount
FROM product_orders po
WHERE p.order_id = po.id
AND p.platform_fee = 0
AND po.platform_fee_amount > 0;
