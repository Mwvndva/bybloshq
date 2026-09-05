-- ROLLBACK for migrations/20260905130000_add_creator_referral_earnings_metadata_column.sql
--
-- Safety: CAUTION. Dropping this column re-introduces a latent bug — the running
-- application writes to creator_referral_earnings.metadata in two places:
--   * settlement.service.js#reverseCreatorEarningsForRefund (every refund/reversal
--     of an order that carried a creator-refers-seller reward), and
--   * the self-referral review-hold feature (records its flag here).
-- With the column gone, the first such reversal fails with "column metadata does
-- not exist" and rolls back the whole reversal transaction. Any data already in
-- `metadata` is permanently lost by the DROP.
--
-- Only roll this back if you are ALSO reverting the application code that depends
-- on the column (i.e. a full revert to before this session's changes).
--
-- Run with: psql "$DATABASE_URL" -f scripts/rollback/20260905130000_down.sql

BEGIN;

ALTER TABLE creator_referral_earnings DROP COLUMN IF EXISTS metadata;

-- Un-record the migration so `npm run migrate` re-applies it on the next run.
DELETE FROM pgmigrations WHERE name = '20260905130000_add_creator_referral_earnings_metadata_column';

COMMIT;
