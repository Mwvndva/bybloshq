# Staging environment

A staging environment that matches production **shape** with safe **values**:
same containers, same wiring, same code path — but a separate database,
Paystack **test-mode** keys, throwaway secrets, and a staging domain. The point
is that deploying to staging is a true dry run of a production deploy, so the
class of bugs that only appear when the stack is actually assembled (connection
pooling, SSL, DNS, env-var gaps, migrate ordering) surface here first.

## What makes up the stack

> **Fresh-database bootstrap.** `npm run migrate` (run by the `migrate` one-shot
> service, and by Render's `preDeployCommand`) detects a genuinely empty database
> and provisions it from the full schema snapshot (`server/test/schema.sql`) —
> the same known-good path CI uses — then applies only migrations newer than the
> snapshot. This is necessary because the incremental migrations do not replay
> cleanly from zero (ordering). A partially-migrated or fully-migrated database
> is left to the normal incremental runner. So a brand-new stack bootstraps
> correctly from `docker compose up` with no manual schema step.

Inherited unchanged from [`docker-compose.yml`](../docker-compose.yml) — this is
the production topology:

| Service    | Role                                                        |
|------------|-------------------------------------------------------------|
| `postgres` | PostgreSQL 15 data store                                    |
| `migrate`  | one-shot; runs `npm run migrate` then exits; backend/worker wait for it to finish successfully |
| `redis`    | cache + rate-limit store                                    |
| `backend`  | HTTP API (`PORT=3000`), `BYBLOS_PROCESS_ROLE=all`           |
| `worker`   | cron / outbox replay / settlement promotion (`split-workers` profile) |
| `frontend` | built Vite SPA served by unprivileged nginx on `:8080`      |
| `nginx`    | TLS termination + reverse proxy (`/` → frontend, `/api` → backend:3000) |

## Bring it up

1. **On the staging host**, copy the env template and fill it in:
   ```bash
   cp server/.env.staging.example .env      # .env is what env_file: .env loads (gitignored)
   # edit .env: staging DB name/password, TEST Paystack keys, staging domain, fresh secrets
   ```
2. Provide TLS certs at `./ssl/fullchain.pem` and `./ssl/privkey.pem` (or adjust
   the nginx volume mounts), and point the staging DNS record at the host.
3. Start the full stack, worker included:
   ```bash
   COMPOSE_PROFILES=split-workers \
     docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
   ```
4. **Smoke test** once containers are healthy:
   ```bash
   # DB-backed liveness (checks a real SELECT 1 against Postgres)
   curl -fsS https://staging.bybloshq.space/api/health   | jq .
   # readiness probe
   curl -fsS https://staging.bybloshq.space/api/health/ready | jq .
   ```
   Then run the real Paystack **test-mode** round trip described in the sandbox
   scripts (`server/scripts/manual-paystack-sandbox-*.mjs`) against the staging
   webhook URL, and walk one order of each fulfilment type end-to-end (the flows
   covered by `server/test/fulfillment.integration.test.js`).

## Parity vs. production — and the deliberate differences

| Aspect                 | Production            | Staging                          | Same shape? |
|------------------------|-----------------------|----------------------------------|-------------|
| Container topology     | 7 services            | identical                        | ✅ |
| Migrate-before-boot    | `migrate` one-shot    | identical                        | ✅ |
| TLS / nginx / HTTP2    | real certs            | staging certs, same nginx config | ✅ |
| Redis                  | real container        | real container                   | ✅ |
| Database               | production DB         | **separate** `byblos_staging`    | ⚠ intentional |
| Paystack keys          | `sk_live_` / `pk_live_` | **`sk_test_` / `pk_test_`**    | ⚠ intentional |
| Domain                 | bybloshq.space        | staging.bybloshq.space           | ⚠ intentional |
| Secrets (JWT, admin…)  | production values     | throwaway staging values         | ⚠ intentional |

## Findings from the pre-staging audit

Discovered while reading the real deploy files. All four have since been
resolved; recorded here for the record and because the reasoning still matters.

1. **Six env vars were required-at-boot but unused by the running app — FIXED.**
   `validateEnv.js` previously listed `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `MARKETING_EMAIL`, `MARKETING_PASSWORD`, `MZIGO_EMAIL`, `MZIGO_PASSWORD` in
   `REQUIRED_ENV_VARS`, so the backend `process.exit(1)`ed on boot if any was
   missing, in every environment — yet the running API/worker never read them.
   Two further problems surfaced while fixing it: the admin/marketing four are
   validated by the very seed scripts that consume them
   (`scripts/seed-admin.js`, `scripts/seed-marketing-admin.js`), and
   `MZIGO_EMAIL`/`MZIGO_PASSWORD` were read by **nothing** — the Mzigo bootstrap
   actually reads `MZIGO_EGO_EMAIL`/`MZIGO_EGO_PASSWORD`. Fixed: the six moved
   out of boot-fail into a non-fatal `ACCOUNT_SEED_ENV_VARS` advisory (the app
   now boots and simply warns when they are unset), and the advisory names the
   correct `MZIGO_EGO_*` vars.

2. **The readiness probe checked Postgres but not Redis — FIXED.**
   `/api/health/ready` now also pings Redis and reports its status in the JSON
   (`redis: connected | disconnected | degraded | in_memory_fallback`). Because
   Redis is an intentionally-optional dependency (the app fails open to an
   in-memory rate-limit store), the Redis result is **reported but non-fatal**:
   Postgres remains the only hard gate, so a Redis blip does not pull a
   still-serviceable instance out of rotation, while a misconfigured staging box
   is now visible in the probe output.

3. **`server/Dockerfile` `EXPOSE 3002` / `PORT` default vs. compose `PORT=3000`
   — FIXED.** The Dockerfile now uses `EXPOSE 3000` and defaults the health
   check to `:3000`, matching how the stack is actually run.

4. **Migrations ran twice on backend boot — FIXED.** The backend image's `CMD`
   is now just `npm start`; migrations run exactly once via the dedicated
   compose `migrate` one-shot service (and, on Render, via
   `preDeployCommand: npm run migrate`). This also removes the needless
   migrate race that would occur when the backend is scaled to multiple
   replicas.

## Seeding test accounts

To exercise the fulfilment / commission / referral / self-referral flows as a
real logged-in user (not just in code), seed a coherent set of interconnected
accounts:

```bash
cd server
SEED_TEST_ACCOUNTS=true npm run seed:test-accounts
# or against a specific env file:
SEED_TEST_ACCOUNTS=true DOTENV_CONFIG_PATH=.env.staging npm run seed:test-accounts
```

It is idempotent (re-running upserts) and guarded: it refuses to run without the
explicit `SEED_TEST_ACCOUNTS=true` opt-in and refuses against production-looking
hosts. It creates verified, active, log-in-ready accounts and prints their
credentials:

| Role | Email | Notes |
|------|-------|-------|
| admin | `admin@byblos.test` | admin dashboard |
| seller | `seller@byblos.test` | shop "Test Atelier", 10% creator commission, **referred by** the creator |
| creator | `creator@byblos.test` | linked to the seller; **also owns a buyer profile** on the same user → self-referral case |
| buyer | `buyer@byblos.test` | independent, legitimate buyer (control) |

Relationships wired: a `seller_creator_links` row (code `TESTCREATORLINK`) so the
creator earns commission on the seller's sales; `sellers.referred_by_creator_id`
so the creator-referral reward path has data; and the creator's own buyer
profile so self-referral detection can be triggered. The Mzigo Ego logistics
login is created on first login from `MZIGO_EGO_EMAIL` / `MZIGO_EGO_PASSWORD`.

(The passwords are fixed, obviously-test values printed by the script — never use
this against production; the guard is there to make that hard.)

## Observability / real-time alerting

The backend pushes critical failures to an incoming webhook in real time, so
live testing surfaces problems as they happen instead of leaving them in a log
stream or an unwatched `fraud_events` row. Set `ALERT_WEBHOOK_URL` to any Slack /
Google Chat / Mattermost / Discord incoming webhook (and optionally
`ALERT_ENV_LABEL=staging` so alerts are tagged by environment). What gets pushed:

- Uncaught exceptions and unhandled promise rejections (API and worker), plus
  server/worker failed-to-start.
- Non-operational `5xx` API errors (expected `4xx`/404/413 are excluded to keep
  the channel signal, not noise).
- Fraud / payment-integrity events — amount mismatch, missing order reference,
  creator self-referral — routed through both `recordFraudEvent` choke points.

It is safe by construction (`server/src/shared/utils/alerting.js`): never throws,
never blocks a transaction, de-duplicates identical alerts within a 60s window,
scrubs secrets/PII from alert context, and is a pure log-only no-op when
`ALERT_WEBHOOK_URL` is unset — so leaving it unconfigured changes nothing.

## What only you can do (needs infrastructure this repo can't provide)

- Provision the staging host and DNS record (`staging.bybloshq.space`).
- Issue/mount the staging TLS certificate.
- Populate `.env` with real staging secrets and Paystack **test-mode** keys.
- Register the staging webhook URL in the Paystack dashboard's test-mode
  settings for the duration of the verification.
