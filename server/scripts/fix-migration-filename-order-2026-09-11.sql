-- One-off production data fix, 2026-09-11.
--
-- Context: 16 migration files used a bare 8-digit YYYYMMDD prefix (plus one
-- exact-duplicate-timestamp pair among otherwise-correct 14-digit files).
-- node-pg-migrate's getTimestamp() only real-parses exactly-13 or exactly-17
-- digit prefixes; anything else falls back to raw numeric magnitude, so file
-- sort order silently diverged from true execution (run_on) order. This was
-- undetected because checkOrder was never enabled. Full writeup in the
-- accompanying commit and server/test/migrationFilenameOrder.test.js.
--
-- The 16 migration FILES have already been renamed on disk (git history
-- preserved via `git mv`) to real 14-digit YYYYMMDDHHMMSS prefixes that sort
-- correctly. This script is the matching half: it renames the corresponding
-- pgmigrations.name rows so node-pg-migrate keeps recognizing them as
-- ALREADY RUN (matched by name) instead of as new migrations to apply.
--
-- MUST run against production before the renamed-files deploy reaches it --
-- otherwise the next `npm run migrate` treats these 16 as new/pending and
-- re-runs their SQL against a database that already has their effects
-- applied (several are not idempotent, e.g. ADD COLUMN without IF NOT
-- EXISTS, so that would fail the deploy outright rather than just being a
-- no-op).
--
-- Run with:  psql "$DATABASE_URL" -f fix-migration-filename-order-2026-09-11.sql
-- (use the DIRECT, non-pooled Neon endpoint -- same reasoning as every other
-- one-off admin script in this repo: a single short-lived session, no
-- pooler-session-affinity concerns either way, but consistent with house
-- practice.)
--
-- Safe: each row is matched on BOTH its immutable `id` AND its expected OLD
-- name, so a mismatch (unexpected prior state) updates 0 rows for that pair
-- instead of clobbering something unexpected. psql prints "UPDATE 16" after
-- this statement -- read that number before trusting it worked. If it prints
-- anything other than 16, STOP and diagnose before deploying the renamed
-- files -- do not re-run or force it.

BEGIN;

WITH renames(id, old_name, new_name) AS (
  VALUES
    (3,  '20240925_create_buyers_table',                 '20240925120000_create_buyers_table'),
    (4,  '20241001_add_theme_to_sellers',                 '20241001120000_add_theme_to_sellers'),
    (5,  '20250107_add_location_fields_to_buyers',         '20250107120000_add_location_fields_to_buyers'),
    (6,  '20250108_add_location_fields_to_sellers',        '20250108120000_add_location_fields_to_sellers'),
    (7,  '20250822_create_buyers_table',                  '20250822120000_create_buyers_table'),
    (8,  '20250825_add_shop_name_to_sellers',             '20250825120000_add_shop_name_to_sellers'),
    (9,  '20250831_add_provider_reference_to_payments',   '20250831120000_add_provider_reference_to_payments'),
    (10, '20250901_add_api_ref_to_payments',              '20250901120000_add_api_ref_to_payments'),
    (11, '20250902_add_ticket_number_unique_constraint',  '20250902120000_add_ticket_number_unique_constraint'),
    (12, '20250903_create_wishlist_table',                '20250903120000_create_wishlist_table'),
    (22, '20251001120000_remove_balance_from_sellers',    '20251001120001_remove_balance_from_sellers'),
    (23, '20251001120001_update_payouts_table',           '20251001120002_update_payouts_table'),
    (32, '20251025_add_delivery_statuses',                '20251025120000_add_delivery_statuses'),
    (33, '20251025_add_paid_payment_status',              '20251025120001_add_paid_payment_status'),
    (34, '20260418_drop_shipping_address',                '20260418120000_drop_shipping_address'),
    (36, '20260419_add_buyer_refunds',                    '20260419120000_add_buyer_refunds')
)
UPDATE pgmigrations p
SET name = r.new_name
FROM renames r
WHERE p.id = r.id AND p.name = r.old_name;

COMMIT;

-- Verification (run separately, read-only, safe to run any time):
--   SELECT id, name, run_on FROM pgmigrations ORDER BY run_on, id;
-- Confirm all 16 new names above appear and no old names remain.
