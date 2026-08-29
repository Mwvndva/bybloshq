// Drop and recreate the test database from scratch.
//
// Gives a clean slate without Docker: terminates open connections, DROPs the
// test database if present, then CREATEs it empty. Run migrations afterwards
// (the `db:test:reset` npm script chains `db:migrate:test` for you).
//
//   npm run db:test:reset   # drop + create + migrate
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

const { Client } = pg;

const dbName = process.env.DB_NAME;
const connection = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

// Safety guard: dropping a database is destructive — require a clearly-test name.
if (!dbName || !/test/i.test(dbName)) {
  console.error(
    `Refusing to drop database "${dbName ?? '(unset)'}" — DB_NAME must contain "test". ` +
      'Check server/.env.test.'
  );
  process.exit(1);
}

async function main() {
  const client = new Client({ ...connection, database: 'postgres' });
  await client.connect();
  try {
    // Terminate other sessions so DROP DATABASE isn't blocked.
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    // Identifier cannot be parameterized; dbName is validated to match /test/ above.
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✓ Reset database "${dbName}" on ${connection.host}:${connection.port} (now empty).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Failed to reset test database: ${err.message}`);
  process.exit(1);
});
