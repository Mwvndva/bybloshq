// server/test/setup.js
//
// Loaded via `node --import ./test/setup.js --test ...` (see server/package.json).
// This file previously did not exist, so `npm run test` in server/ could not
// run at all. Keep this intentionally minimal and safe:
//
//   - Force NODE_ENV=test so any code path that branches on environment
//     (e.g. infrastructure/database/database.js's production-host safety
//     guard) never mistakes a test run for anything else.
//   - Only load `server/.env.test` if it exists, and ONLY that file — never
//     fall back to `.env` or `.env.production`. A missing `.env.test` means
//     any test that actually needs a live database will fail with a clear
//     "missing DB_* env var" error instead of silently connecting to a real
//     database. Pure-logic unit tests (the only tests in this suite today)
//     do not need this at all.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnvPath = path.resolve(__dirname, '../.env.test');

if (existsSync(testEnvPath)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: testEnvPath });
}
