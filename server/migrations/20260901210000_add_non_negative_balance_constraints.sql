-- Migration: add non-negative financial balance constraints
-- Reason: Move balance integrity invariant to database layer, preventing negative balances

-- 1. sellers constraints
ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_balance_non_negative;
ALTER TABLE sellers ADD CONSTRAINT sellers_balance_non_negative CHECK (balance >= 0);

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_pending_settlement_balance_non_negative;
ALTER TABLE sellers ADD CONSTRAINT sellers_pending_settlement_balance_non_negative CHECK (pending_settlement_balance >= 0);

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_withdrawal_reserved_balance_non_negative;
ALTER TABLE sellers ADD CONSTRAINT sellers_withdrawal_reserved_balance_non_negative CHECK (withdrawal_reserved_balance >= 0);

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_refund_reserved_balance_non_negative;
ALTER TABLE sellers ADD CONSTRAINT sellers_refund_reserved_balance_non_negative CHECK (refund_reserved_balance >= 0);

-- 2. creators constraints
ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_balance_non_negative;
ALTER TABLE creators ADD CONSTRAINT creators_balance_non_negative CHECK (balance >= 0);

ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_total_earnings_non_negative;
ALTER TABLE creators ADD CONSTRAINT creators_total_earnings_non_negative CHECK (total_earnings >= 0);

ALTER TABLE creators DROP CONSTRAINT IF EXISTS creators_total_referral_earnings_non_negative;
ALTER TABLE creators ADD CONSTRAINT creators_total_referral_earnings_non_negative CHECK (total_referral_earnings >= 0);

-- 3. buyers constraints
ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_refunds_non_negative;
ALTER TABLE buyers ADD CONSTRAINT buyers_refunds_non_negative CHECK (refunds >= 0);

-- 4. product_orders monetary constraints
ALTER TABLE product_orders DROP CONSTRAINT IF EXISTS product_orders_total_amount_non_negative;
ALTER TABLE product_orders ADD CONSTRAINT product_orders_total_amount_non_negative CHECK (total_amount >= 0);

ALTER TABLE product_orders DROP CONSTRAINT IF EXISTS product_orders_seller_payout_amount_non_negative;
ALTER TABLE product_orders ADD CONSTRAINT product_orders_seller_payout_amount_non_negative CHECK (seller_payout_amount >= 0);

ALTER TABLE product_orders DROP CONSTRAINT IF EXISTS product_orders_platform_fee_amount_non_negative;
ALTER TABLE product_orders ADD CONSTRAINT product_orders_platform_fee_amount_non_negative CHECK (platform_fee_amount >= 0);
