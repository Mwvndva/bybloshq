-- Migration: Creator Shop Collaboration Marketplace
-- Reason: Allow sellers to list their shops for creators, and creators to discover and request collaborations.

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS is_creator_marketplace_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS creator_shop_requests (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (creator_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_shop_requests_seller ON creator_shop_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_creator_shop_requests_creator ON creator_shop_requests(creator_id, status);
