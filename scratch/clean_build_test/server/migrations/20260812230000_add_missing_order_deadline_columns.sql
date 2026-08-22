-- Migration: Add missing product_orders deadline and lifecycle columns.
-- These columns are used by orderDeadline.service.js but were never
-- created via a migration (they only existed on the old VPS database).
-- The master migration was already applied, so we add them here with
-- ADD COLUMN IF NOT EXISTS guards so this is safe to run on any environment.

ALTER TABLE product_orders
    ADD COLUMN IF NOT EXISTS seller_dropoff_deadline         TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS buyer_pickup_deadline           TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS ready_for_pickup_at             TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancelled_at                    TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auto_cancelled_reason           TEXT,
    ADD COLUMN IF NOT EXISTS pre_handoff_sla                 JSONB,
    ADD COLUMN IF NOT EXISTS client_checkout_token           VARCHAR(255),
    ADD COLUMN IF NOT EXISTS custom_production_deadline_at   TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS custom_production_grace_deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS custom_production_reminder_sent_at  TIMESTAMP WITH TIME ZONE;

-- Index for fast cron lookup of overdue seller drop-offs
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_dropoff_deadline
    ON product_orders (seller_dropoff_deadline)
    WHERE seller_dropoff_deadline IS NOT NULL
      AND auto_cancelled_reason IS NULL;

-- Index for fast cron lookup of overdue buyer pickups
CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_pickup_deadline
    ON product_orders (buyer_pickup_deadline)
    WHERE buyer_pickup_deadline IS NOT NULL
      AND auto_cancelled_reason IS NULL;
