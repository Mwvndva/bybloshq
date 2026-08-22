-- Referral program persistence and idempotency safeguards.

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16),
    ADD COLUMN IF NOT EXISTS referred_by_seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referral_active_until TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS total_referral_earnings NUMERIC(15, 2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_referral_code_unique
    ON sellers(referral_code)
    WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS sellers_referred_by_seller_id_idx
    ON sellers(referred_by_seller_id)
    WHERE referred_by_seller_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sellers_referral_active_until_idx
    ON sellers(referral_active_until)
    WHERE referral_active_until IS NOT NULL;

UPDATE sellers
SET total_referral_earnings = 0
WHERE total_referral_earnings IS NULL;

ALTER TABLE sellers
    ALTER COLUMN total_referral_earnings SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS referral_earnings_log (
    id SERIAL PRIMARY KEY,
    referrer_seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    referred_seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INTEGER NOT NULL CHECK (period_year >= 2020),
    referred_gmv NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reward_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referral_earnings_log_period_unique
        UNIQUE (referrer_seller_id, referred_seller_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS referral_earnings_log_referrer_idx
    ON referral_earnings_log(referrer_seller_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS referral_earnings_log_referred_idx
    ON referral_earnings_log(referred_seller_id, period_year, period_month);
