-- ============================================================
-- Migration: Add Seller Referral Program
-- Date: 2026-03-17
-- ============================================================

-- 1. Add referral columns to sellers table (idempotent)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS referred_by_seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS referral_active_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS total_referral_earnings DECIMAL(12,2) DEFAULT 0;

-- 2. Index for fast referral code lookups
CREATE INDEX IF NOT EXISTS idx_sellers_referral_code ON sellers(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sellers_referred_by ON sellers(referred_by_seller_id) WHERE referred_by_seller_id IS NOT NULL;

-- 3. Referral earnings log table (idempotent)
CREATE TABLE IF NOT EXISTS referral_earnings_log (
    id                  SERIAL PRIMARY KEY,
    referrer_seller_id  INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    referred_seller_id  INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    period_month        INTEGER NOT NULL,        -- e.g. 3 for March
    period_year         INTEGER NOT NULL,         -- e.g. 2026
    referred_gmv        DECIMAL(12,2) NOT NULL,  -- referred seller's GMV that month
    reward_amount       DECIMAL(12,2) NOT NULL,  -- 0.2% of referred_gmv
    credited_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_seller_id, referred_seller_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_referral_log_referrer ON referral_earnings_log(referrer_seller_id);
CREATE INDEX IF NOT EXISTS idx_referral_log_referred ON referral_earnings_log(referred_seller_id);
