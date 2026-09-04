-- Migration: remove creator-to-creator referral columns
-- Reason: Deprecate creator-to-creator referral link and attribution. Keep only creator-to-seller referrals.

ALTER TABLE creators
    DROP COLUMN IF EXISTS referred_by_creator_id CASCADE;

ALTER TABLE creator_referral_earnings
    DROP COLUMN IF EXISTS referred_creator_id CASCADE;
