import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkOrdersTable() {
  try {
    // Check if the orders table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'orders'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('The orders table does not exist.');
      return;
    }

    // Get the structure of the orders table
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position;
    `);

    console.log('Orders table structure:');
    console.table(tableStructure.rows);

    // Get the current status values in the orders table
    const statusValues = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status;
    `);

    console.log('\nCurrent status values in orders table:');
    console.table(statusValues.rows);

  } catch (error) {
    console.error('Error checking orders table:', error);
  } finally {
    await pool.end();
  }
}

checkOrdersTable();
