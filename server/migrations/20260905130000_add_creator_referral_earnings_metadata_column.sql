-- Migration: add missing metadata column to creator_referral_earnings
-- Reason: settlement.service.js#reverseCreatorEarningsForRefund already writes
-- `metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb` to this table on
-- every reversal (see creator_referral_earnings.status = 'reversed' /
-- 'reversal_compensation_required' branches), but no migration ever added a
-- `metadata` column to it — only creator_earnings has one. That UPDATE would
-- fail with "column metadata does not exist" the first time an order with a
-- creator-refers-seller reward attached is refunded/reversed, rolling back
-- the whole reversal transaction. Found while building the self-referral
-- review-hold feature, which also needs this column to record its flag.

ALTER TABLE creator_referral_earnings
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
