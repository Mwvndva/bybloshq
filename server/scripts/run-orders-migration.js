import { Pool } from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Read and execute the migration file
    const migrationPath = join(__dirname, '../migrations/20250921_create_orders_tables.sql');
    const migrationSQL = await readFile(migrationPath, 'utf8');
    
    console.log('Running orders migration...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('Orders migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
