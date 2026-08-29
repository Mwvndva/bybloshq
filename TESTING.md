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

Integration tests need a migrated Postgres. Bring up the ephemeral test stack
(Docker), migrate it, then run:

```bash
cd server
npm run db:test:up        # postgres:15 on :3001, redis:7 on :6380 (tmpfs, docker-compose.test.yml)
npm run db:migrate:test   # apply migrations to the test DB
npm run test:integration
npm run db:test:down       # tear down + wipe volumes
```

`test/helpers/db.js` provides the shared pool plus `assertTablesExist` and
`withRollback` (runs a test inside a transaction that is always rolled back, so
tests never leave residue). `test/repositories/schema.integration.test.js` is a
template — copy its shape for real repository tests.

By default the test setup stubs Redis so unit tests need no daemon. To exercise
a real Redis in an integration test, set `USE_REAL_REDIS=true` and point
`REDIS_URL` at the test container.

## End-to-end (Playwright)

E2E specs live in `e2e/`. Playwright's `webServer` builds and serves the
frontend on `:3000` automatically, so the smoke test needs no manual setup:

```bash
npm run build        # E2E serves the production build via `npm run preview`
npm run test:e2e
```

Auth-flow specs are gated on credentials from the environment and are skipped
unless those are provided. For full-stack E2E, start the backend
(`cd server && npm start` against a migrated test DB) before running Playwright.

## CI

`.github/workflows/test.yml` runs two jobs in parallel:

- **frontend** — `npm ci` + `npm run test:coverage`, uploads the coverage
  report as an artifact.
- **backend** — spins up `postgres:15` and `redis:7` service containers, writes
  a CI `.env.test` pointed at them, migrates the test DB, then runs the unit and
  integration suites.
