# Migration rollback plan

This project's migration runner (`server/scripts/migrate.js`, node-pg-migrate)
is **up-only** — it runs with `direction: 'up'` and none of the 100+ migrations
carry a `Down Migration` section. So rollback here is done with the explicit,
tested reverse-SQL scripts in [`server/scripts/rollback/`](../server/scripts/rollback),
run manually with `psql`. They live outside `migrations/` so the runner can
never mistake them for forward migrations.

Each script runs in a single transaction (all-or-nothing) and also removes its
own `pgmigrations` bookkeeping row, so afterwards a normal `npm run migrate`
cleanly **re-applies** the forward migration.

## Migrations with a rollback script

| Migration | What it did | Rollback safety |
|-----------|-------------|-----------------|
| `20260905120000_add_missing_balance_and_amount_constraints` | Adds 4 non-negative `CHECK` constraints (payouts.amount, creator_earnings.amount/base_amount, creator_referral_earnings.amount) | **Safe** — drops backstops only, no data change |
| `20260905130000_add_creator_referral_earnings_metadata_column` | Adds `metadata JSONB` to creator_referral_earnings | **Caution** — the running app writes this column; dropping it re-introduces a latent bug and loses any metadata. Only roll back with a matching code revert |
| `20260905140000_drop_legacy_order_completion_payout_trigger` | Drops the legacy `handle_order_completion_trigger` + function | **⚠ Danger** — its inverse re-creates the trigger that silently blocks every seller escrow release / creator commission. Almost never roll this back |
| `20260910000000_add_terms_accepted_to_creators` | Adds `terms_accepted`/`terms_accepted_at` to creators | **⚠ Danger** — the running app (creator registration + login) writes/reads these columns. Only roll back with a matching code revert, or every creator registration/login 500s again — this is the exact migration whose absence caused the 2026-09-10 incident |
| `20260910010000_backfill_creator_terms_accepted` | `UPDATE creators SET terms_accepted = TRUE ...` for pre-existing rows | **No data rollback exists** — a backfill can't be cleanly inverted (no record of which rows it touched vs. were already TRUE), and un-doing it would just re-lock real creator accounts out of login for no benefit. The script only clears the bookkeeping row |

## How to roll back

Against the target database (use the `DATABASE_URL` or `DB_*` for that host).
Roll back newest-first when a later migration depends on an earlier one's
schema (e.g. the terms_accepted backfill depends on the column the earlier
migration added):

```bash
cd server
# Roll back a single migration (pick the ones you actually need):
psql "$DATABASE_URL" -f scripts/rollback/20260910010000_down.sql          # bookkeeping only — see table
psql "$DATABASE_URL" -f scripts/rollback/20260910000000_down.sql          # danger — see table
psql "$DATABASE_URL" -f scripts/rollback/20260905120000_down.sql
psql "$DATABASE_URL" -f scripts/rollback/20260905130000_down.sql          # caution — see table
psql "$DATABASE_URL" -f scripts/rollback/20260905140000_down.sql          # danger — see table
```

To re-apply forward afterwards, just run the normal runner — it sees the
bookkeeping rows are gone and re-applies exactly those migrations:

```bash
npm run migrate
```

## Pre-flight for the constraint migration (forward direction)

The constraint migration is additive but not free: if it is ever run against a
database that already holds a row violating `amount >= 0` / `base_amount >= 0`,
`ADD CONSTRAINT` **fails outright** (it validates existing rows) rather than
corrupting anything — but you want to learn that before a deploy window, not
during one. Dry-run against a copy of the real data first:

```sql
SELECT 'payouts' AS t, count(*) FROM payouts WHERE amount < 0
UNION ALL SELECT 'creator_earnings.amount', count(*) FROM creator_earnings WHERE amount < 0
UNION ALL SELECT 'creator_earnings.base_amount', count(*) FROM creator_earnings WHERE base_amount < 0
UNION ALL SELECT 'creator_referral_earnings', count(*) FROM creator_referral_earnings WHERE amount < 0;
```

All counts must be `0` before the forward migration will apply.

## Going forward: writing a rollback script for a new migration

This plan only covers the migrations listed above — it does not retroactively
cover the other 95+ migrations already in the repo (most predate this plan,
are already baked into every environment, and many are trivial enough that a
formal rollback script wouldn't add real safety). The gap that actually
matters is future migrations, so: **whenever you add a migration that isn't
purely additive-and-inert** (i.e. it changes something a rollback might ever
need to touch — drops/renames a column, adds a `NOT NULL`/`CHECK` constraint
that could reject existing rows, changes data, drops a trigger/function,
anything the running app depends on), add its rollback alongside it in the
same PR, not after the fact:

1. Create `server/scripts/rollback/<same-timestamp>_down.sql` (matching the
   forward migration's filename prefix). Wrap the reverse SQL in
   `BEGIN; ... COMMIT;` and end with:
   ```sql
   DELETE FROM pgmigrations WHERE name = '<forward migration filename without .sql>';
   ```
   so `npm run migrate` cleanly re-applies it afterward.
2. Write a header comment classifying it honestly, matching the table above:
   **Safe** (no data change, nothing running depends on it), **Caution**
   (running code depends on it — name exactly what breaks and require a
   matching code revert), **⚠ Danger** (reverses something load-bearing —
   name the specific incident-class failure it would reproduce), or **No data
   rollback exists** (a backfill/data migration with no way to distinguish
   what it touched — say so rather than writing a script that silently
   reverts the wrong rows).
3. Actually run the round trip against a disposable database before trusting
   it — restore → forward migrate → rollback → forward migrate again — the
   same sequence documented in Verification below. A rollback script that has
   never been executed is a guess, not a tested procedure.
4. Add a row to the table above and a line in *How to roll back*.

## Verification

The full round trip for the first 3 migrations was tested against a fresh
database restored from `server/test/schema.sql`:

1. **Restore** → 4 constraints present, `metadata` column present, legacy trigger
   absent, 3 bookkeeping rows present.
2. **Run all 3 rollback scripts** → constraints dropped, column dropped, legacy
   trigger + function re-created, bookkeeping rows removed.
3. **`npm run migrate`** → constraints back, column back, trigger dropped again,
   bookkeeping restored — with no error.

Fixing step 3 surfaced (and fixed) a separate snapshot bug: `server/test/schema.sql`
seeded the `pgmigrations` rows with explicit ids but never advanced
`pgmigrations_id_seq`, so the first new migration applied on top of a restored
snapshot failed with a `pgmigrations_pkey` duplicate-key error. A `setval` after
the seed rows now advances the sequence past the seeded ids.

The terms_accepted pair was verified the same way against the local test
database (not a fresh restore — schema.sql already includes both columns, so
this exercised the more realistic "roll back on a live-shaped database" path
instead):

1. **Before** → `terms_accepted`/`terms_accepted_at` present on `creators`,
   both bookkeeping rows present, existing creators `terms_accepted = true`.
2. **Run both rollback scripts (newest-first: 010000, then 000000)** →
   both columns dropped, both bookkeeping rows removed, no error.
3. **`npm run migrate`** → both columns restored, backfill re-applied to any
   row left at the column's `DEFAULT FALSE`, both bookkeeping rows restored —
   with no error.
