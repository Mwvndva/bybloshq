-- Mobile/app notification infrastructure.
-- The app continues to use the same users table and core business tables.

CREATE TABLE IF NOT EXISTS notification_device_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'creator', 'admin', 'logistics')),
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    token TEXT NOT NULL,
    device_id TEXT,
    app_version TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_notification_device_tokens_user_active
    ON notification_device_tokens(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_notification_device_tokens_role_active
    ON notification_device_tokens(role, is_active);

CREATE TABLE IF NOT EXISTS app_notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_role TEXT NOT NULL CHECK (recipient_role IN ('buyer', 'seller', 'creator', 'admin', 'logistics')),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::text[],
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient_created
    ON app_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient_unread
    ON app_notifications(recipient_user_id, created_at DESC)
    WHERE read_at IS NULL;
