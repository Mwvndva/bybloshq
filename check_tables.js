import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 3001,
  database: 'byblos7',
  user: 'postgres',
  password: 'nurubot'
});

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Tables in the database:');
    console.table(res.rows);
    
    // Check if we have any order-related tables
    const orderTables = res.rows.filter(row => 
      row.table_name.toLowerCase().includes('order')
    );
    
    if (orderTables.length > 0) {
      console.log('\nOrder-related tables found:');
      console.table(orderTables);
      
      // Show the structure of the first order table found
      const orderTable = orderTables[0].table_name;
      console.log(`\nStructure of ${orderTable}:`);
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${orderTable}';
      `);
      console.table(structure.rows);
    } else {
      console.log('\nNo order-related tables found.');
    }
    
  } catch (err) {
    console.error('Error checking database:', err);
  } finally {
    await pool.end();
  }
}

checkTables();
