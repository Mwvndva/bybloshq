-- Migration: fill gaps in non-negative financial constraints
-- Reason: 20260901210000_add_non_negative_balance_constraints.sql covered the
-- primary balance columns, plus the credit-record `amount` columns on
-- payout/commission tables that had no constraint anywhere. These add a
-- database-level backstop consistent with that migration's intent — they do
-- NOT touch any column where a negative value can be legitimately produced
-- by current application logic (verified against EscrowManager, settlement,
-- and creator/withdrawal service code before writing this migration).
--
-- NOTE: an earlier draft of this migration also added
-- creators_withdrawal_reserved_balance_non_negative and
-- buyers_refund_withdrawal_reserved_balance_non_negative. Verified against a
-- fully-migrated database that both columns already carry an equivalent
-- CHECK (>= 0) from their original column-creation migration
-- (20260602120000_unify_creator_withdrawals.sql, via Postgres's
-- auto-generated `<table>_<column>_check` constraint name) — so those two
-- were redundant duplicates, not real gaps, and are not repeated here.

-- 1. payouts.amount — seller escrow-release payout amount; EscrowManager
-- already refuses to insert a payout row when sellerPayoutAmount <= 0.
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_amount_non_negative;
ALTER TABLE payouts ADD CONSTRAINT payouts_amount_non_negative CHECK (amount >= 0);

-- 2. creator_earnings.amount / base_amount — commission credit records;
-- CreatorService.creditCreatorForOrder already refuses to insert when
-- amount <= 0. Reversals change `status`, never mutate `amount` negative.
ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS creator_earnings_amount_non_negative;
ALTER TABLE creator_earnings ADD CONSTRAINT creator_earnings_amount_non_negative CHECK (amount >= 0);

ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS creator_earnings_base_amount_non_negative;
ALTER TABLE creator_earnings ADD CONSTRAINT creator_earnings_base_amount_non_negative CHECK (base_amount >= 0);

-- 3. creator_referral_earnings.amount — referral reward credit records;
-- CreatorService.creditCreatorReferralForSeller already refuses amount <= 0.
ALTER TABLE creator_referral_earnings DROP CONSTRAINT IF EXISTS creator_referral_earnings_amount_non_negative;
ALTER TABLE creator_referral_earnings ADD CONSTRAINT creator_referral_earnings_amount_non_negative CHECK (amount >= 0);
