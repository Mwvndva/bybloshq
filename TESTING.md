# Testing

This repo has two test surfaces — the **frontend** (React + Vite, tested with
Vitest) and the **backend** (`server/`, Node/Express, tested with the built-in
`node:test` runner). CI runs both on every push and PR to `main`
(`.github/workflows/test.yml`).

## Frontend (Vitest)

Config lives in the `test` block of `vite.config.ts`. Tests run in jsdom with
`@testing-library/react`. All network traffic is intercepted by **MSW**
(Mock Service Worker) — see `src/test/msw/`. Any request without a matching
handler fails the test (`onUnhandledRequest: 'error'`), so tests never touch a
real network.

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # run with V8 coverage (thresholds enforced)
```

- **Add a default mock**: edit `src/test/msw/handlers.ts`.
- **Override per-test**: `server.use(http.get(...))` inside the test; handlers
  reset automatically after each test.
- **Render with providers**: use `renderWithProviders` from
  `src/test/utils/renderWithProviders.tsx` (wraps React Query + Router).

## Backend (node:test)

The backend separates fast, no-dependency tests from tests that need a real
Postgres:

| Script | Glob | Needs DB? |
| --- | --- | --- |
| `npm test` | `test/*.test.js` | No (Redis is stubbed) |
| `npm run test:integration` | `test/**/*.integration.test.js` | Yes |
| `npm run test:all` | both | Yes |
| `npm run test:coverage` | `test/*.test.js` | No |

Test env config is loaded from `server/.env.test` (gitignored). Create it from
the template once:

```bash
cd server
npm run test:setup-env   # copies .env.test.example -> .env.test (never overwrites)
```

### Running integration tests locally

Integration tests need a Postgres with the schema loaded. The schema is
provisioned from a committed snapshot (`server/test/schema.sql`), **not** from
the incremental migrations — the repo's migration history cannot build from an
empty database (early migrations reference tables created later, and the
migrate bootstrap only fires on an already-populated DB). Provisioning is a
single, reliable schema load instead.

Point `server/.env.test` at any reachable Postgres (`DB_*`), then:

```bash
cd server
npm run db:test:setup      # create DB if missing + apply server/test/schema.sql
npm run test:integration
```

Useful DB scripts:

| Script | What it does |
| --- | --- |
| `db:test:create` | `CREATE DATABASE` if it doesn't exist (guarded to `*test*` names) |
| `db:test:schema` | apply `test/schema.sql` into the test DB |
| `db:test:setup` | `db:test:create` + `db:test:schema` |
| `db:test:reset` | drop + recreate + re-apply schema (clean slate) |
| `db:test:up` / `db:test:down` | ephemeral Postgres/Redis via Docker (`docker-compose.test.yml`) — only if Docker is installed |

If you use the Docker stack, run `db:test:up` first, then `db:test:setup`.

**Regenerating the schema snapshot** — when the production schema changes:

```bash
pg_dump --schema-only --no-owner --no-privileges --no-comments \
        -d <your-dev-db> -f server/test/schema.sql
```

`test/helpers/db.js` provides the shared pool plus `assertTablesExist` and
`withRollback` (runs a test inside a transaction that is always rolled back, so
tests never leave residue). `test/repositories/schema.integration.test.js` is a
template — copy its shape for real repository tests.

By default the test setup stubs Redis so unit tests need no daemon. To exercise
a real Redis in an integration test, set `USE_REAL_REDIS=true` and point
`REDIS_URL` at the test container.

## Paystack (payment testing)

Payments run against Paystack's real **test-mode** sandbox
(`PAYSTACK_BASE_URL=https://api.paystack.co`). Put your own test-mode keys in
`server/.env.test` (gitignored — never commit them):

```
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
```

The checkout uses Paystack's charge (STK-push) flow plus status polling
(`GET /api/payments/status/:reference`); the authoritative payment update
arrives via a **webhook**, so that's what you configure for testing.

**Webhook URL** — the backend receives events at:

```
POST /api/webhooks/paystack
```

It is HMAC-verified with `PAYSTACK_SECRET_KEY` (optionally IP-filtered via
`PAYSTACK_WEBHOOK_IPS`; leave unset locally). Paystack's servers must reach it,
so `localhost` won't do — expose the backend (port 3003) with a tunnel:

```bash
ngrok http 3003
```

Then set Dashboard → Settings → API Keys & Webhooks (Test mode) → **Webhook URL**
to `https://<subdomain>.ngrok-free.app/api/webhooks/paystack` (or, on a deployed
backend, `https://<backend-host>/api/webhooks/paystack`).

## End-to-end (Playwright)

E2E specs live in `e2e/`. Playwright's `webServer` builds and serves the
frontend on `:3000` automatically, so the smoke test needs no manual setup:

```bash
npm run build        # E2E serves the production build via `npm run preview`
npm run test:e2e
```

Auth-flow specs are gated on credentials from the environment and are skipped
unless those are provided. For full-stack E2E, start the backend
(`cd server && npm start` against a test DB provisioned with `db:test:setup`)
before running Playwright.

## CI

`.github/workflows/test.yml` runs two jobs in parallel:

- **frontend** — `npm ci` + `npm run test:coverage`, uploads the coverage
  report as an artifact.
- **backend** — spins up `postgres:15` and `redis:7` service containers, writes
  a CI `.env.test` pointed at them, provisions the test schema from
  `server/test/schema.sql` (`db:test:setup`), then runs the unit and
  integration suites.
