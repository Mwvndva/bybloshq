-- Migration: logistics data model
-- Reason: Support door-to-door delivery and seller pickup tracking without mutating money state.

CREATE TABLE IF NOT EXISTS logistics_partners (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    contact_name VARCHAR(160),
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp_number VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_partners_slug_unique
    ON logistics_partners(slug);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_partners_user_unique
    ON logistics_partners(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_partners_active
    ON logistics_partners(active);

INSERT INTO logistics_partners (name, slug, active, metadata)
VALUES (
    'Mzigo Ego',
    'mzigo-ego',
    TRUE,
    '{"seeded_by":"20260510010000_add_logistics_data_model"}'::jsonb
)
ON CONFLICT (slug)
DO UPDATE SET
    name = EXCLUDED.name,
    active = TRUE,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS logistics_requests (
    id BIGSERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE RESTRICT,
    partner_id BIGINT NOT NULL REFERENCES logistics_partners(id) ON DELETE RESTRICT,
    package_code VARCHAR(80),
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    service_level VARCHAR(40) NOT NULL DEFAULT 'standard',
    deadline_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_requests_order_id_unique UNIQUE (order_id),
    CONSTRAINT logistics_requests_status_check CHECK (
        status IN (
            'pending',
            'payment_pending',
            'active',
            'in_progress',
            'completed',
            'cancelled',
            'failed',
            'manual_review'
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_requests_package_code_unique
    ON logistics_requests(package_code)
    WHERE package_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_requests_partner_status
    ON logistics_requests(partner_id, status, deadline_at, created_at);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_status_deadline
    ON logistics_requests(status, deadline_at, created_at);

CREATE TABLE IF NOT EXISTS logistics_legs (
    id BIGSERIAL PRIMARY KEY,
    logistics_request_id BIGINT NOT NULL REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    leg_type VARCHAR(20) NOT NULL,
    payer VARCHAR(20) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'payment_pending',
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    fee_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    fee_currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    distance_km NUMERIC(10, 2),
    origin_label VARCHAR(160),
    origin_address TEXT,
    origin_lat NUMERIC(10, 8),
    origin_lng NUMERIC(11, 8),
    destination_label VARCHAR(160),
    destination_address TEXT,
    destination_lat NUMERIC(10, 8),
    destination_lng NUMERIC(11, 8),
    deadline_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_legs_request_leg_type_unique UNIQUE (logistics_request_id, leg_type),
    CONSTRAINT logistics_legs_id_request_unique UNIQUE (id, logistics_request_id),
    CONSTRAINT logistics_legs_leg_type_check CHECK (leg_type IN ('pickup', 'delivery')),
    CONSTRAINT logistics_legs_payer_check CHECK (payer IN ('buyer', 'seller', 'platform')),
    CONSTRAINT logistics_legs_status_check CHECK (
        status IN (
            'payment_pending',
            'pending',
            'assigned',
            'started',
            'picked_up',
            'dropped_at_hub',
            'out_for_delivery',
            'delivered',
            'failed',
            'delayed',
            'cancelled'
        )
    ),
    CONSTRAINT logistics_legs_fee_amount_check CHECK (fee_amount >= 0),
    CONSTRAINT logistics_legs_distance_km_check CHECK (distance_km IS NULL OR distance_km >= 0),
    CONSTRAINT logistics_legs_origin_lat_check CHECK (origin_lat IS NULL OR origin_lat BETWEEN -90 AND 90),
    CONSTRAINT logistics_legs_origin_lng_check CHECK (origin_lng IS NULL OR origin_lng BETWEEN -180 AND 180),
    CONSTRAINT logistics_legs_destination_lat_check CHECK (destination_lat IS NULL OR destination_lat BETWEEN -90 AND 90),
    CONSTRAINT logistics_legs_destination_lng_check CHECK (destination_lng IS NULL OR destination_lng BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_logistics_legs_request_status
    ON logistics_legs(logistics_request_id, status, deadline_at, created_at);

CREATE INDEX IF NOT EXISTS idx_logistics_legs_payment_id
    ON logistics_legs(payment_id)
    WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_legs_type_status
    ON logistics_legs(leg_type, status, deadline_at, created_at);

CREATE TABLE IF NOT EXISTS logistics_tracking_events (
    id BIGSERIAL PRIMARY KEY,
    logistics_request_id BIGINT NOT NULL REFERENCES logistics_requests(id) ON DELETE RESTRICT,
    logistics_leg_id BIGINT,
    event_key VARCHAR(255),
    event_type VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL,
    message TEXT,
    source VARCHAR(40) NOT NULL DEFAULT 'system',
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_label VARCHAR(160),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logistics_tracking_events_source_check CHECK (
        source IN ('system', 'mzigo', 'admin', 'buyer', 'seller')
    ),
    CONSTRAINT logistics_tracking_events_leg_request_fk
        FOREIGN KEY (logistics_leg_id, logistics_request_id)
        REFERENCES logistics_legs(id, logistics_request_id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_tracking_events_event_key_unique
    ON logistics_tracking_events(event_key)
    WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logistics_tracking_events_request_created
    ON logistics_tracking_events(logistics_request_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_logistics_tracking_events_leg_created
    ON logistics_tracking_events(logistics_leg_id, created_at, id)
    WHERE logistics_leg_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_logistics_tracking_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'logistics_tracking_events are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS logistics_tracking_events_immutable ON logistics_tracking_events;

CREATE TRIGGER logistics_tracking_events_immutable
    BEFORE UPDATE OR DELETE ON logistics_tracking_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_logistics_tracking_event_mutation();

COMMENT ON TABLE logistics_partners IS
    'Logistics partner profiles. Credentials should attach through users.user_id, not through this table.';

COMMENT ON TABLE logistics_requests IS
    'One logistics request per order/package. Logistics status is operational only and must not mutate payment, escrow, seller payout, or wallet state.';

COMMENT ON TABLE logistics_legs IS
    'Pickup and delivery legs for a logistics request. At most one pickup leg and one delivery leg are allowed per request.';

COMMENT ON TABLE logistics_tracking_events IS
    'Immutable logistics timeline history for buyer, seller, admin, and logistics partner tracking.';
