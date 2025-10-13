import { pool } from '../src/config/database.js';

async function checkAppliedMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('Checking applied migrations...');
    
    // Check if migrations table exists
    const migrationsTableExists = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      )`
    );
    
    if (!migrationsTableExists.rows[0].exists) {
      console.log('Migrations table does not exist. No migrations have been applied.');
      return;
    }
    
    // Get all applied migrations
    const appliedMigrations = await client.query(
      'SELECT name, run_on FROM migrations ORDER BY run_on DESC'
    );
    
    console.log('Applied migrations:');
    if (appliedMigrations.rows.length === 0) {
      console.log('  No migrations have been applied.');
    } else {
      appliedMigrations.rows.forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration.name} (applied at: ${migration.run_on})`);
      });
    }
    
    // Check if our target migration has been applied
    const targetMigration = '20250930150000_add_product_orders_tables.sql';
    const isApplied = appliedMigrations.rows.some(m => m.name === targetMigration);
    
    console.log(`\nIs '${targetMigration}' applied? ${isApplied ? '✅ Yes' : '❌ No'}`);
    
  } catch (error) {
    console.error('Error checking applied migrations:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAppliedMigrations().catch(console.error);
