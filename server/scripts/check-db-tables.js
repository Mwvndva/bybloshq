import { pool } from '../src/config/database.js';

async function checkTables() {
  const requiredTables = ['products', 'orders', 'order_items'];
  const client = await pool.connect();
  
  try {
    console.log('Checking database tables...');
    
    for (const table of requiredTables) {
      try {
        const result = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        const exists = result.rows[0].exists;
        console.log(`Table ${table}: ${exists ? '✅ Exists' : '❌ Missing'}`);
        
        if (exists) {
          // Get table columns
          const columnsResult = await client.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = $1`,
            [table]
          );
          
          console.log(`  Columns in ${table}:`);
          columnsResult.rows.forEach(col => {
            console.log(`    - ${col.column_name} (${col.data_type})`);
          });
        }
      } catch (error) {
        console.error(`Error checking table ${table}:`, error.message);
      }
    }
    
    // Check for sample data
    console.log('\nChecking for sample data...');
    const tablesWithData = ['products', 'orders', 'order_items'];
    
    for (const table of tablesWithData) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        console.log(`Table ${table} has ${countResult.rows[0].count} rows`);
      } catch (error) {
        console.error(`Error counting rows in ${table}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('\nDatabase check completed.');
  }
}

checkTables().catch(console.error);
