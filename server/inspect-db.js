import { pool } from './src/config/database.js';

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log('=== PAYMENTS TABLE COLUMNS ===');
    const paymentCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'payments' 
      ORDER BY ordinal_position
    `);
    console.table(paymentCols.rows);
    
    console.log('\n=== TICKETS TABLE COLUMNS ===');
    const ticketCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tickets' 
      ORDER BY ordinal_position
    `);
    console.table(ticketCols.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
