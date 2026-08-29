// Template database-integration test. Proves the integration pipeline end to
// end: a migrated test Postgres is reachable, core tables exist, and reads/
// writes are transactional with rollback isolation. Copy this shape for real
// repository tests (insert via a repository, assert, rollback).
//
// Requires the test DB to be up and migrated:
//   docker compose -f ../docker-compose.test.yml up -d --wait
//   npm run db:migrate:test
//   npm run test:integration
import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { pool, assertTablesExist, withRollback, closePool } from '../helpers/db.js';

describe('Database integration (test DB)', () => {
  after(async () => {
    await closePool();
  });

  it('connects to the test database', async () => {
    const { rows } = await pool.query('SELECT 1 AS ok');
    assert.strictEqual(rows[0].ok, 1);
  });

  it('has core tables from migrations', async () => {
    await assertTablesExist(['users', 'products', 'sellers', 'buyers', 'product_orders', 'payments']);
  });

  it('supports transactional read/write with rollback isolation', async () => {
    await withRollback(async (client) => {
      await client.query('CREATE TEMP TABLE _probe (id int) ON COMMIT DROP');
      await client.query('INSERT INTO _probe (id) VALUES (1), (2)');
      const { rows } = await client.query('SELECT count(*)::int AS n FROM _probe');
      assert.strictEqual(rows[0].n, 2);
    });
  });
});
