import { pool } from '../src/config/database.js';

async function checkTablesAfterMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Checking tables after migration...');
    
    // Check if product_orders table exists
    const productOrdersTable = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'product_orders'
       ORDER BY ordinal_position`
    );
    
    console.log('\nproduct_orders table columns:');
    if (productOrdersTable.rows.length === 0) {
      console.log('  product_orders table does not exist');
    } else {
      productOrdersTable.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Check if order_items table exists
    const orderItemsTable = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'order_items'
       ORDER BY ordinal_position`
    );
    
    console.log('\norder_items table columns:');
    if (orderItemsTable.rows.length === 0) {
      console.log('  order_items table does not exist');
    } else {
      orderItemsTable.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Check if payouts table exists
    const payoutsTable = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'payouts'
       ORDER BY ordinal_position`
    );
    
    console.log('\npayouts table columns:');
    if (payoutsTable.rows.length === 0) {
      console.log('  payouts table does not exist');
    } else {
      payoutsTable.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Check if order_status_history table exists
    const statusHistoryTable = await client.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'order_status_history'
       ORDER BY ordinal_position`
    );
    
    console.log('\norder_status_history table columns:');
    if (statusHistoryTable.rows.length === 0) {
      console.log('  order_status_history table does not exist');
    } else {
      statusHistoryTable.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking tables after migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTablesAfterMigration().catch(console.error);
