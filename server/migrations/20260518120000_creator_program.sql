-- Migration: creator program
-- Reason: Add invited creator accounts, creator links, and completed-sale creator commissions.

INSERT INTO roles (name, slug, created_at, updated_at)
VALUES ('Creator', 'creator', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS creators (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mpesa_number VARCHAR(50) NOT NULL,
    instagram_link TEXT,
    tiktok_link TEXT,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_sales INTEGER NOT NULL DEFAULT 0,
    total_earnings NUMERIC(15, 2) NOT NULL DEFAULT 0,
    referral_code VARCHAR(24) UNIQUE,
    referred_by_creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
    total_referral_earnings NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creators_user_id ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_email ON creators(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators(status);

CREATE TABLE IF NOT EXISTS seller_creator_invites (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invite_token VARCHAR(96) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_creator_invites_seller ON seller_creator_invites(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_creator_invites_token ON seller_creator_invites(invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_creator_invites_pending_email
    ON seller_creator_invites(seller_id, LOWER(email))
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS seller_creator_links (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    code VARCHAR(32) UNIQUE NOT NULL,
    commission_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0100,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (seller_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_creator_links_seller ON seller_creator_links(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_creator_links_creator ON seller_creator_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_seller_creator_links_code ON seller_creator_links(code);

CREATE TABLE IF NOT EXISTS creator_earnings (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
    seller_creator_link_id INTEGER REFERENCES seller_creator_links(id) ON DELETE SET NULL,
    order_id INTEGER NOT NULL UNIQUE REFERENCES product_orders(id) ON DELETE RESTRICT,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    rate NUMERIC(6, 4) NOT NULL,
    base_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'credited',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_seller ON creator_earnings(seller_id);

CREATE TABLE IF NOT EXISTS creator_referral_earnings (
    id SERIAL PRIMARY KEY,
    referrer_creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
    referred_creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES product_orders(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'credited',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creator_referral_earnings_referrer ON creator_referral_earnings(referrer_creator_id);
