const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Read and execute the migration file
    const migrationPath = path.join(__dirname, '../migrations/20250930150000_add_product_orders_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running Pesapal V2 migration...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('Pesapal V2 migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pesapal V2 migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
