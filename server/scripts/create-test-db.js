// Create the test database if it does not already exist.
//
// Reproducible alternative to `docker compose ... up` for machines without
// Docker: connects to the Postgres maintenance database using the DB_* values
// from .env.test and issues CREATE DATABASE when the target is missing.
// Idempotent — a no-op if the database already exists.
//
//   npm run db:test:create
//   npm run db:migrate:test
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

// Safety guard: never operate on a database that isn't clearly a test DB.
if (!dbName || !/test/i.test(dbName)) {
  console.error(
    `Refusing to create database "${dbName ?? '(unset)'}" — DB_NAME must contain "test". ` +
      'Check server/.env.test.'
  );
  process.exit(1);
}

async function main() {
  // Connect to the default maintenance DB; you cannot CREATE the DB you are in.
  const client = new Client({ ...connection, database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (rowCount > 0) {
      console.log(`✓ Database "${dbName}" already exists — nothing to do.`);
      return;
    }
    // Identifier cannot be parameterized; dbName is validated to match /test/ above.
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✓ Created database "${dbName}" on ${connection.host}:${connection.port}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Failed to create test database: ${err.message}`);
  process.exit(1);
});
