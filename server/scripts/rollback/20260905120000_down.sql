-- ROLLBACK for migrations/20260905120000_add_missing_balance_and_amount_constraints.sql
--
-- Safety: SAFE. These are additive CHECK constraints; dropping them removes a
-- database-level backstop but changes no data and cannot fail. Re-applying the
-- forward migration afterwards only succeeds if every row still satisfies
-- `amount >= 0` / `base_amount >= 0` (which the application already guarantees).
--
-- Run with: psql "$DATABASE_URL" -f scripts/rollback/20260905120000_down.sql
-- (or the local DB_* connection). Wrapped in a transaction: all-or-nothing.

BEGIN;

ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_amount_non_negative;
ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS creator_earnings_amount_non_negative;
ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS creator_earnings_base_amount_non_negative;
ALTER TABLE creator_referral_earnings DROP CONSTRAINT IF EXISTS creator_referral_earnings_amount_non_negative;

-- Un-record the migration so `npm run migrate` re-applies it on the next run.
DELETE FROM pgmigrations WHERE name = '20260905120000_add_missing_balance_and_amount_constraints';

COMMIT;
