-- Migration: webhook replay protection and per-recipient notification delivery
-- Reason: Fail closed on callback replay and retry only failed notification recipients.

CREATE TABLE IF NOT EXISTS webhook_replay_dedupe (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(160) NOT NULL,
    provider_reference VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_replay_dedupe_expires_at
    ON webhook_replay_dedupe(expires_at);

CREATE TABLE IF NOT EXISTS event_recipient_deliveries (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    recipient_key VARCHAR(255) NOT NULL,
    channel VARCHAR(40) NOT NULL DEFAULT 'whatsapp',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    provider_message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS event_recipient_deliveries_unique
    ON event_recipient_deliveries(event_id, recipient_key, channel);

CREATE INDEX IF NOT EXISTS idx_event_recipient_deliveries_retry
    ON event_recipient_deliveries(status, next_retry_at, created_at)
    WHERE status IN ('pending', 'failed', 'processing');
