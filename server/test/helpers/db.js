// Helpers for database integration tests. Import the shared pool so tests use
// the same connection config (and test-mode safety guard) as the app.
import assert from 'node:assert';
import { pool } from '../../src/infrastructure/database/database.js';

export { pool };

/**
 * Assert that every named table exists in the public schema. Fails with a
 * helpful hint when migrations haven't been applied to the test DB.
 * @param {string[]} tables
 */
export async function assertTablesExist(tables) {
  const { rows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)`,
    [tables]
  );
  const found = new Set(rows.map((r) => r.table_name));
  for (const table of tables) {
    assert.ok(
      found.has(table),
      `expected table "${table}" to exist — run \`npm run db:migrate:test\` against the test DB`
    );
  }
}

/**
 * Run a function inside a transaction that is always rolled back, so each test
 * leaves the database exactly as it found it (no cleanup, no cross-test bleed).
 * @param {(client: import('pg').PoolClient) => Promise<void>} fn
 */
export async function withRollback(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

/** Close the shared pool. Call once in a suite's `after` hook. */
export async function closePool() {
  await pool.end();
}
