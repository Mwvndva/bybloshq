-- Migration: public logistics tracking links
-- Reason: Provide opaque buyer/seller tracking links without exposing internal IDs.

CREATE TABLE IF NOT EXISTS logistics_tracking_links (
    id BIGSERIAL PRIMARY KEY,
    logistics_request_id BIGINT NOT NULL REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    audience VARCHAR(20) NOT NULL,
    public_id VARCHAR(64) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_tracking_links_request_audience_unique UNIQUE (logistics_request_id, audience),
    CONSTRAINT logistics_tracking_links_public_id_unique UNIQUE (public_id),
    CONSTRAINT logistics_tracking_links_audience_check CHECK (audience IN ('buyer', 'seller'))
);

CREATE INDEX IF NOT EXISTS idx_logistics_tracking_links_public_active
    ON logistics_tracking_links(public_id, active);

CREATE INDEX IF NOT EXISTS idx_logistics_tracking_links_request
    ON logistics_tracking_links(logistics_request_id, audience);

COMMENT ON TABLE logistics_tracking_links IS
    'Opaque public buyer/seller tracking link lookup. Tokens must not expose payment refs, payout data, or internal IDs.';
