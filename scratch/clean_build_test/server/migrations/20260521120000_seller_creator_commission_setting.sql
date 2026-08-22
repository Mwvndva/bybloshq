-- Migration: seller creator commission setting
-- Reason: Allow sellers to set the default creator commission rate from seller settings.

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS creator_commission_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0100;

UPDATE sellers
SET creator_commission_rate = 0.0100
WHERE creator_commission_rate IS NULL;

ALTER TABLE sellers
ADD CONSTRAINT sellers_creator_commission_rate_range
CHECK (creator_commission_rate >= 0.0100 AND creator_commission_rate <= 1.0000)
NOT VALID;

ALTER TABLE sellers
VALIDATE CONSTRAINT sellers_creator_commission_rate_range;
