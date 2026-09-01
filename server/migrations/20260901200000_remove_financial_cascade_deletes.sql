-- Migration: remove cascading deletes on critical financial tables
-- Reason: Financial records must survive the lifecycle of parent entities and cannot be destroyed by hard deletion

-- 1. payouts -> product_orders
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_order_id_fkey;
ALTER TABLE payouts
    ADD CONSTRAINT payouts_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES product_orders(id)
    ON DELETE RESTRICT;

-- 2. withdrawal_requests -> sellers, creators, buyers
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_seller_id_fkey;
ALTER TABLE withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_seller_id_fkey
    FOREIGN KEY (seller_id)
    REFERENCES sellers(id)
    ON DELETE RESTRICT;

ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_creator_id_fkey;
ALTER TABLE withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_creator_id_fkey
    FOREIGN KEY (creator_id)
    REFERENCES creators(id)
    ON DELETE RESTRICT;

ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_buyer_id_fkey;
ALTER TABLE withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_buyer_id_fkey
    FOREIGN KEY (buyer_id)
    REFERENCES buyers(id)
    ON DELETE RESTRICT;

-- 3. refund_requests -> buyers
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_buyer_id_fkey;
ALTER TABLE refund_requests
    ADD CONSTRAINT refund_requests_buyer_id_fkey
    FOREIGN KEY (buyer_id)
    REFERENCES buyers(id)
    ON DELETE RESTRICT;

-- 4. payment_provider_attempts -> payments
ALTER TABLE payment_provider_attempts DROP CONSTRAINT IF EXISTS payment_provider_attempts_payment_id_fkey;
ALTER TABLE payment_provider_attempts
    ADD CONSTRAINT payment_provider_attempts_payment_id_fkey
    FOREIGN KEY (payment_id)
    REFERENCES payments(id)
    ON DELETE RESTRICT;

-- 5. payout_provider_attempts -> withdrawal_requests
ALTER TABLE payout_provider_attempts DROP CONSTRAINT IF EXISTS payout_provider_attempts_withdrawal_request_id_fkey;
ALTER TABLE payout_provider_attempts
    ADD CONSTRAINT payout_provider_attempts_withdrawal_request_id_fkey
    FOREIGN KEY (withdrawal_request_id)
    REFERENCES withdrawal_requests(id)
    ON DELETE RESTRICT;

-- 6. referral_earnings_log -> sellers
ALTER TABLE referral_earnings_log DROP CONSTRAINT IF EXISTS referral_earnings_log_referred_seller_id_fkey;
ALTER TABLE referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_referred_seller_id_fkey
    FOREIGN KEY (referred_seller_id)
    REFERENCES sellers(id)
    ON DELETE RESTRICT;

ALTER TABLE referral_earnings_log DROP CONSTRAINT IF EXISTS referral_earnings_log_referrer_seller_id_fkey;
ALTER TABLE referral_earnings_log
    ADD CONSTRAINT referral_earnings_log_referrer_seller_id_fkey
    FOREIGN KEY (referrer_seller_id)
    REFERENCES sellers(id)
    ON DELETE RESTRICT;
