-- Migration: add creator WhatsApp number
-- Reason: Store creator WhatsApp contacts for successful-sale notifications.

ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_creators_whatsapp_number
    ON creators (whatsapp_number)
    WHERE whatsapp_number IS NOT NULL;
