# Byblos load test (#30 perf/load)

A [k6](https://k6.io) script that drives the **read-heavy public hot paths** at up to
500 req/s. It never initiates payments (no real money) and never calls authed
endpoints, so it is safe to run against a **staging** deploy.

## Run

```bash
# install k6 first (https://k6.io/docs/get-started/installation/)
BASE_URL=https://byblos-staging.example.com \
ORDER_NUMBER=ORD-20260831-000042 \   # a real PAID order from staging (exercises the poll path)
PEAK_RPS=500 \
k6 run scripts/load/byblos-load.k6.js
```

## What it exercises
- `GET /api/health` — baseline
- `GET /api/public/products?limit=24` — catalog list
- `GET /api/sellers/search?city=Nairobi` — seller search
- `GET /api/public/orders/:orderNumber/status` — the **order-status poll** (the path this
  pass indexed via `idx_payments_metadata_order_id`)

## Thresholds (pass/fail)
- overall error rate < 1%
- poll p95 < 500ms, catalog p95 < 800ms, search p95 < 1000ms, health p95 < 200ms

## IMPORTANT before running
1. **Global rate limiter** (`app.use('/api', globalLimiter)`) will `429` a single-source
   load test. For the test window, raise/disable it on staging (e.g. an env flag) or run
   k6 from multiple distributed load zones — otherwise you are load-testing the limiter.
2. **DB connection ceiling.** The pool is `max: 100` per process and BOTH the web and the
   worker process run — up to ~200 Postgres connections. Confirm the staging Postgres plan
   allows that (or front it with PgBouncer), or you'll hit "too many connections" under load
   before the app itself is the bottleneck.
3. Point it at **staging**, not production.

## Findings from the static/DB perf pass (already applied where safe)
- Added `idx_payments_metadata_order_id` — the buyer poll join was a full Seq Scan.
- Dropped 3 redundant duplicate indexes (products/users/order_number) to cut write cost.
- Flagged (ops, not code): pool `max:100` × 2 processes vs the Postgres connection limit;
  the marketing/seller analytics dashboards run full-table aggregations (fine now — low
  frequency — but candidates for cached/materialized views as data grows).
