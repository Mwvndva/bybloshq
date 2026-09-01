// Load the committed test schema (server/test/schema.sql) into the test DB.
//
// The repository's incremental migrations cannot build a schema from an empty
// database (early migrations reference tables created later; the migrate
// bootstrap only fires on an already-populated DB). So the test environment is
// provisioned from a single authoritative schema snapshot instead — generated
// from the dev database with:
//
//   pg_dump --schema-only --no-owner --no-privileges --no-comments \
//           -d <dev-db> -f server/test/schema.sql
//
// Regenerate schema.sql whenever the production schema changes.
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

const { Client } = pg;

const dbName = process.env.DB_NAME;
const schemaPath = path.resolve(__dirname, '../test/schema.sql');

if (!dbName || !/test/i.test(dbName)) {
  console.error(
    `Refusing to load schema into "${dbName ?? '(unset)'}" — DB_NAME must contain "test".`
  );
  process.exit(1);
}
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema snapshot not found: ${schemaPath}`);
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });
  await client.connect();
  try {
    // Simple-query protocol runs the whole multi-statement dump in one call.
    await client.query(sql);
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log(`✓ Applied test schema to "${dbName}" — ${rows[0].n} tables.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Failed to apply test schema: ${err.message}`);
  process.exit(1);
});
