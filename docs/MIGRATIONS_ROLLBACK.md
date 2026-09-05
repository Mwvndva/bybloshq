# Migration rollback plan

This project's migration runner (`server/scripts/migrate.js`, node-pg-migrate)
is **up-only** — it runs with `direction: 'up'` and none of the 100 migrations
carry a `Down Migration` section. So rollback here is done with the explicit,
tested reverse-SQL scripts in [`server/scripts/rollback/`](../server/scripts/rollback),
run manually with `psql`. They live outside `migrations/` so the runner can
never mistake them for forward migrations.

Each script runs in a single transaction (all-or-nothing) and also removes its
own `pgmigrations` bookkeeping row, so afterwards a normal `npm run migrate`
cleanly **re-applies** the forward migration.

## The three migrations from this change set

| Migration | What it did | Rollback safety |
|-----------|-------------|-----------------|
| `20260905120000_add_missing_balance_and_amount_constraints` | Adds 4 non-negative `CHECK` constraints (payouts.amount, creator_earnings.amount/base_amount, creator_referral_earnings.amount) | **Safe** — drops backstops only, no data change |
| `20260905130000_add_creator_referral_earnings_metadata_column` | Adds `metadata JSONB` to creator_referral_earnings | **Caution** — the running app writes this column; dropping it re-introduces a latent bug and loses any metadata. Only roll back with a matching code revert |
| `20260905140000_drop_legacy_order_completion_payout_trigger` | Drops the legacy `handle_order_completion_trigger` + function | **⚠ Danger** — its inverse re-creates the trigger that silently blocks every seller escrow release / creator commission. Almost never roll this back |

## How to roll back

Against the target database (use the `DATABASE_URL` or `DB_*` for that host):

```bash
cd server
# Roll back a single migration (pick the ones you actually need):
psql "$DATABASE_URL" -f scripts/rollback/20260905120000_down.sql
psql "$DATABASE_URL" -f scripts/rollback/20260905130000_down.sql   # caution — see table
psql "$DATABASE_URL" -f scripts/rollback/20260905140000_down.sql   # danger — see table
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

## Verification

The full round trip was tested against a fresh database restored from
`server/test/schema.sql`:

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
