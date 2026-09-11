-- ROLLBACK for migrations/20260910010000_backfill_creator_terms_accepted.sql
--
-- Safety: DATA CHANGE HAS NO CLEAN INVERSE. This migration ran:
--   UPDATE creators SET terms_accepted = TRUE, terms_accepted_at = COALESCE(...)
--   WHERE terms_accepted = FALSE;
-- It did not record which rows it touched versus which were already TRUE
-- beforehand, so there is no reliable way to distinguish "backfilled by this
-- migration" from "already accepted" after the fact. This script therefore
-- does NOT attempt to flip terms_accepted back to FALSE for anyone -- a script
-- that guessed via terms_accepted_at timestamps would risk also reverting
-- creators who genuinely accepted the terms afterwards through the normal
-- registration/login flow, silently locking real accounts out again.
--
-- It also would not be a meaningful thing to want: this backfill grandfathered
-- pre-existing creators into a requirement that didn't exist when they signed
-- up (see the migration's own header). Undoing it doesn't fix anything -- it
-- just re-locks real accounts out of login for no benefit. If this migration
-- is being rolled back, it's almost certainly because
-- 20260910000000_add_terms_accepted_to_creators.sql is also being rolled back
-- (the column this backfill writes to is going away entirely) -- roll that
-- back too, and roll it back AFTER this one (newest migration first).
--
-- What this script actually does: only removes the pgmigrations bookkeeping
-- row, so `npm run migrate` will cleanly re-run the (idempotent -- it only
-- touches rows still FALSE) backfill if the schema is ever restored to a
-- point before it ran.
--
-- Run with: psql "$DATABASE_URL" -f scripts/rollback/20260910010000_down.sql

BEGIN;

DELETE FROM pgmigrations WHERE name = '20260910010000_backfill_creator_terms_accepted';

COMMIT;
