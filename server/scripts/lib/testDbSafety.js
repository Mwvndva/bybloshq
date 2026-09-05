/**
 * testDbSafety.js
 *
 * Shared guard for the three db:test:* scripts (create-test-db.js,
 * apply-test-schema.js, reset-test-db.js). All three perform destructive
 * operations (CREATE DATABASE, DROP DATABASE, wholesale schema load) and
 * must never be pointed at anything that isn't unmistakably a disposable
 * test database — mirrors the exact guard already used in
 * infrastructure/database/database.js for NODE_ENV === 'test'.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads env exactly like scripts/migrate.js does: DOTENV_CONFIG_PATH first,
 * then .env.test when NODE_ENV=test, otherwise .env/.env.production. These
 * scripts are only ever meant to run against a test database, so the safety
 * check below applies regardless of which file actually got loaded.
 */
export function loadTestEnv() {
  let envPath;
  if (process.env.DOTENV_CONFIG_PATH) {
    envPath = path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH);
  } else if (process.env.NODE_ENV === 'test') {
    envPath = path.resolve(__dirname, '../../.env.test');
  } else {
    envPath = path.resolve(__dirname, '../../.env');
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

/**
 * Refuses to proceed unless every signal says "this is a disposable test
 * database" — never trust a single check alone.
 * @returns {{ host: string, port: number, user: string, password: string, name: string }}
 */
export function requireSafeTestDbConfig() {
  const host = String(process.env.DB_HOST || '');
  const name = String(process.env.DB_NAME || '');
  const databaseUrl = String(process.env.DATABASE_URL || '');
  const port = Number.parseInt(process.env.DB_PORT, 10) || 5432;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  const isProdHost = host.includes('render.com') || host.includes('amazonaws.com') || databaseUrl.includes('render.com');
  const isSafeTestDb = name.toLowerCase().endsWith('_test') || name.toLowerCase().includes('test');

  if (isProdHost) {
    console.error(`FATAL SAFETY GUARD: "${host}" looks like a production host. Refusing to run a db:test:* script against it.`);
    process.exit(1);
  }
  if (!isSafeTestDb) {
    console.error(`FATAL SAFETY GUARD: DB_NAME "${name}" does not look like a test database (must contain "test"). Refusing to run.`);
    process.exit(1);
  }
  if (!user || !password || !name) {
    console.error('FATAL SAFETY GUARD: DB_USER, DB_PASSWORD, and DB_NAME must all be set (via .env.test or DOTENV_CONFIG_PATH).');
    process.exit(1);
  }

  return { host: host || 'localhost', port, user, password, name };
}
