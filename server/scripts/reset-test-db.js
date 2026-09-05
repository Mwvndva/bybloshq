/**
 * reset-test-db.js
 *
 * Drops the test database (terminating any existing connections first) and
 * recreates it empty. Used by `npm run db:test:reset`, which chains this
 * with `db:test:schema` to reapply the snapshot afterward. Destructive by
 * design — that's the point of a *test* database reset — but gated by the
 * same requireSafeTestDbConfig guard as the other db:test:* scripts, so it
 * can only ever target something whose name unmistakably says "test".
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
    database: 'postgres', // maintenance DB — must not be connected to the DB we're dropping
    ssl: process.env.DB_SSL === 'false' ? false : undefined
  });

  await client.connect();
  try {
    // Terminate any other sessions on the target DB first, or DROP DATABASE fails.
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name]
    );

    await client.query(`DROP DATABASE IF EXISTS "${name}"`);
    console.log(`[reset-test-db] Dropped database "${name}" (if it existed).`);

    await client.query(`CREATE DATABASE "${name}"`);
    console.log(`[reset-test-db] Recreated empty database "${name}".`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('[reset-test-db] Failed:', error.message);
  process.exit(1);
});
