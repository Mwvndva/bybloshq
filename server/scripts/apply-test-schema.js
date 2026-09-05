/**
 * apply-test-schema.js
 *
 * Loads server/test/schema.sql (a full schema snapshot, not the incremental
 * migrations/ history — see that file's header for why) into the test
 * database. Expects an empty database: run after create-test-db.js on a
 * fresh database, or after reset-test-db.js to reapply from scratch.
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTestEnv, requireSafeTestDbConfig } from './lib/testDbSafety.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.resolve(__dirname, '../test/schema.sql');

loadTestEnv();
const { host, port, user, password, name } = requireSafeTestDbConfig();

const { Client } = pg;

async function run() {
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`[apply-test-schema] Schema snapshot not found at ${SCHEMA_FILE}.`);
    process.exit(1);
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database: name,
    ssl: process.env.DB_SSL === 'false' ? false : undefined
  });

  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`
    );
    if (rows.length > 0) {
      console.error(
        `[apply-test-schema] Database "${name}" already has a schema (found table "users"). ` +
        'Refusing to reapply on top of it — run `npm run db:test:reset` first if you want a clean slate.'
      );
      process.exit(1);
    }

    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log(`[apply-test-schema] Applying schema snapshot to "${name}"...`);
    await client.query(sql);
    console.log(`[apply-test-schema] Schema applied successfully to "${name}".`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('[apply-test-schema] Failed:', error.message);
  process.exit(1);
});
