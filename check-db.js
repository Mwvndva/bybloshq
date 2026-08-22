import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 3001,
  database: 'byblos7',
  user: 'postgres',
  password: 'nurubot',
});

async function checkColumn() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'product_orders' 
      AND column_name = 'seller_payment_amount';
    `);
    console.log('Column exists:', res.rows.length > 0);
    console.log('Column details:', res.rows);
    
    // Check the structure of the table
    const tableRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product_orders';
    `);
    console.log('\nTable structure:');
    console.table(tableRes.rows);
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumn();
