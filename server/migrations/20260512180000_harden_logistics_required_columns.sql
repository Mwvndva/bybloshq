-- Migration: harden logistics required columns
-- Reason: Make runtime-required logistics columns explicit, backfilled, and defaulted while pruning unused schema.

ALTER TABLE logistics_partners
    DROP COLUMN IF EXISTS contact_name,
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS slug VARCHAR(160),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS active BOOLEAN,
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE logistics_partners
SET
    name = COALESCE(NULLIF(name, ''), 'Logistics Partner ' || id::text),
    slug = COALESCE(NULLIF(slug, ''), 'logistics-partner-' || id::text),
    active = COALESCE(active, TRUE),
    metadata = COALESCE(metadata, '{}'::jsonb),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

CREATE UNIQUE INDEX IF NOT EXISTS logistics_partners_slug_unique
    ON logistics_partners(slug);

INSERT INTO logistics_partners (name, slug, active, metadata, created_at, updated_at)
VALUES (
    'Mzigo Ego',
    'mzigo-ego',
    TRUE,
    '{"seeded_by":"20260512180000_harden_logistics_required_columns"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (slug)
DO UPDATE SET
    name = COALESCE(NULLIF(logistics_partners.name, ''), EXCLUDED.name),
    active = TRUE,
    metadata = COALESCE(logistics_partners.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = NOW();

ALTER TABLE logistics_partners
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN slug SET NOT NULL,
    ALTER COLUMN active SET DEFAULT TRUE,
    ALTER COLUMN active SET NOT NULL,
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
    ALTER COLUMN metadata SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE logistics_requests
    ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES product_orders(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS partner_id BIGINT REFERENCES logistics_partners(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS package_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS service_level VARCHAR(40),
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE logistics_requests
SET
    status = COALESCE(NULLIF(status, ''), 'pending'),
    service_level = COALESCE(NULLIF(service_level, ''), 'standard'),
    metadata = COALESCE(metadata, '{}'::jsonb),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM logistics_requests
        WHERE order_id IS NULL OR partner_id IS NULL
    ) THEN
        RAISE EXCEPTION 'logistics_requests has rows missing required order_id or partner_id';
    END IF;
END $$;

ALTER TABLE logistics_requests
    ALTER COLUMN order_id SET NOT NULL,
    ALTER COLUMN partner_id SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'pending',
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN service_level SET DEFAULT 'standard',
    ALTER COLUMN service_level SET NOT NULL,
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
    ALTER COLUMN metadata SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE logistics_legs
    ADD COLUMN IF NOT EXISTS logistics_request_id BIGINT REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS leg_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS payer VARCHAR(20),
    ADD COLUMN IF NOT EXISTS status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS origin_label VARCHAR(160),
    ADD COLUMN IF NOT EXISTS origin_address TEXT,
    ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(10, 8),
    ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(11, 8),
    ADD COLUMN IF NOT EXISTS destination_label VARCHAR(160),
    ADD COLUMN IF NOT EXISTS destination_address TEXT,
    ADD COLUMN IF NOT EXISTS destination_lat NUMERIC(10, 8),
    ADD COLUMN IF NOT EXISTS destination_lng NUMERIC(11, 8),
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE logistics_legs
SET
    status = COALESCE(NULLIF(status, ''), 'payment_pending'),
    fee_amount = COALESCE(fee_amount, 0),
    fee_currency = COALESCE(NULLIF(fee_currency, ''), 'KES'),
    metadata = COALESCE(metadata, '{}'::jsonb),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM logistics_legs
        WHERE logistics_request_id IS NULL
           OR leg_type IS NULL
           OR payer IS NULL
    ) THEN
        RAISE EXCEPTION 'logistics_legs has rows missing required request, leg_type, or payer';
    END IF;
END $$;

ALTER TABLE logistics_legs
    ALTER COLUMN logistics_request_id SET NOT NULL,
    ALTER COLUMN leg_type SET NOT NULL,
    ALTER COLUMN payer SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'payment_pending',
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN fee_amount SET DEFAULT 0,
    ALTER COLUMN fee_amount SET NOT NULL,
    ALTER COLUMN fee_currency SET DEFAULT 'KES',
    ALTER COLUMN fee_currency SET NOT NULL,
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
    ALTER COLUMN metadata SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE logistics_tracking_events
    ADD COLUMN IF NOT EXISTS logistics_request_id BIGINT REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS logistics_leg_id BIGINT,
    ADD COLUMN IF NOT EXISTS event_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS message TEXT,
    ADD COLUMN IF NOT EXISTS source VARCHAR(40),
    ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actor_label VARCHAR(160),
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION prevent_logistics_tracking_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'logistics_tracking_events are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS logistics_tracking_events_immutable ON logistics_tracking_events;

UPDATE logistics_tracking_events
SET
    event_type = COALESCE(NULLIF(event_type, ''), 'legacy.event'),
    status = COALESCE(NULLIF(status, ''), 'pending'),
    source = COALESCE(NULLIF(source, ''), 'system'),
    metadata = COALESCE(metadata, '{}'::jsonb),
    created_at = COALESCE(created_at, NOW());

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM logistics_tracking_events
        WHERE logistics_request_id IS NULL
    ) THEN
        RAISE EXCEPTION 'logistics_tracking_events has rows missing required logistics_request_id';
    END IF;
END $$;

ALTER TABLE logistics_tracking_events
    ALTER COLUMN logistics_request_id SET NOT NULL,
    ALTER COLUMN event_type SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN source SET DEFAULT 'system',
    ALTER COLUMN source SET NOT NULL,
    ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
    ALTER COLUMN metadata SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER logistics_tracking_events_immutable
    BEFORE UPDATE OR DELETE ON logistics_tracking_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logistics_tracking_event_mutation();

ALTER TABLE logistics_tracking_links
    ADD COLUMN IF NOT EXISTS logistics_request_id BIGINT REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS audience VARCHAR(20),
    ADD COLUMN IF NOT EXISTS public_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS active BOOLEAN,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

UPDATE logistics_tracking_links
SET
    active = COALESCE(active, TRUE),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM logistics_tracking_links
        WHERE logistics_request_id IS NULL
           OR audience IS NULL
           OR public_id IS NULL
    ) THEN
        RAISE EXCEPTION 'logistics_tracking_links has rows missing required request, audience, or public_id';
    END IF;
END $$;

ALTER TABLE logistics_tracking_links
    ALTER COLUMN logistics_request_id SET NOT NULL,
    ALTER COLUMN audience SET NOT NULL,
    ALTER COLUMN public_id SET NOT NULL,
    ALTER COLUMN active SET DEFAULT TRUE,
    ALTER COLUMN active SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
