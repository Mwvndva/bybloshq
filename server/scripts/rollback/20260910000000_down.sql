-- ROLLBACK for migrations/20260910000000_add_terms_accepted_to_creators.sql
--
-- Safety: ⚠ DANGER while the current application code is deployed. This is
-- the exact migration whose absence caused the 2026-09-10 production
-- incident: CreatorService.registerDirect()/registerFromInvite() INSERT into
-- creators.terms_accepted/terms_accepted_at, and AuthService.login() reads
-- creators.terms_accepted for the creator terms-acceptance gate. Dropping
-- these columns while that code is still running reproduces the identical
-- failure mode this rollback plan exists to prevent -- every creator
-- registration and every creator login will start 500ing again immediately.
--
-- Only roll this back together with a full revert of the application code
-- that depends on these columns (creator.service.js, creator.controller.js,
-- auth.service.js's creator terms-acceptance branch, and the frontend creator
-- registration terms checkbox). If you're rolling back ONLY because
-- something else broke, this is very likely not the migration you actually
-- want to revert.
--
-- Also roll back 20260910010000_backfill_creator_terms_accepted FIRST (it
-- writes to the columns this script drops) -- see its own rollback script.
--
-- Run with: psql "$DATABASE_URL" -f scripts/rollback/20260910000000_down.sql

BEGIN;

ALTER TABLE public.creators
    DROP COLUMN IF EXISTS terms_accepted,
    DROP COLUMN IF EXISTS terms_accepted_at;

-- Un-record the migration so `npm run migrate` re-applies it on the next run.
DELETE FROM pgmigrations WHERE name = '20260910000000_add_terms_accepted_to_creators';

COMMIT;
