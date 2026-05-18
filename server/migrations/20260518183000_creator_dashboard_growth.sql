-- Migration: creator dashboard growth tools
-- Reason: Track creator link clicks, creator-referred sellers, creator withdrawals, and richer dashboard analytics.

ALTER TABLE seller_creator_links
    ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS creator_link_clicks (
    id SERIAL PRIMARY KEY,
    seller_creator_link_id INTEGER NOT NULL REFERENCES seller_creator_links(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    ip_address VARCHAR(80),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creator_link_clicks_creator_recent
    ON creator_link_clicks(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_link_clicks_link_recent
    ON creator_link_clicks(seller_creator_link_id, created_at DESC);

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS referred_by_creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sellers_referred_by_creator_id
    ON sellers(referred_by_creator_id)
    WHERE referred_by_creator_id IS NOT NULL;

ALTER TABLE creator_referral_earnings
    ALTER COLUMN referred_creator_id DROP NOT NULL;

ALTER TABLE creator_referral_earnings
    ADD COLUMN IF NOT EXISTS referred_seller_id INTEGER REFERENCES sellers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_creator_referral_earnings_referred_seller
    ON creator_referral_earnings(referred_seller_id)
    WHERE referred_seller_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS creator_withdrawal_requests (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL,
    withdrawal_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_deducted NUMERIC(15, 2) NOT NULL DEFAULT 0,
    mpesa_number VARCHAR(50) NOT NULL,
    mpesa_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    provider_reference VARCHAR(255),
    idempotency_key VARCHAR(120) UNIQUE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_creator_recent
    ON creator_withdrawal_requests(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_status
    ON creator_withdrawal_requests(status);
