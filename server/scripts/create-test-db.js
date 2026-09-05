/**
 * create-test-db.js
 *
 * Creates the test database (DB_NAME from .env.test) if it doesn't already
 * exist. Connects to the server's `postgres` maintenance database to do
 * this, since the target database may not exist yet. Safe to run repeatedly
 * — a no-op if the database is already there.
 */
import pg from 'pg';
import { loadTestEnv, requireSafeTestDbConfig } from './lib/testDbSafety.js';

loadTestEnv();
const { host, port, user, password, name } = requireSafeTestDbConfig();

const { Client } = pg;

async function run() {
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres', // maintenance DB — always present, used to CREATE DATABASE
    ssl: process.env.DB_SSL === 'false' ? false : undefined
  });

  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rows.length > 0) {
      console.log(`[create-test-db] Database "${name}" already exists — nothing to do.`);
      return;
    }

    // Database names cannot be parameterized in Postgres; `name` is already
    // validated by requireSafeTestDbConfig (must contain "test") and comes
    // only from a local .env.test file, never from user input.
    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`[create-test-db] Created database "${name}".`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('[create-test-db] Failed:', error.message);
  process.exit(1);
});
