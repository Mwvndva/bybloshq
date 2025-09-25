import { pool } from '../src/config/database.js';

async function checkOrders() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        merchant_reference, 
        status, 
        payment_status, 
        status_updated_at,
        updated_at
      FROM orders 
      WHERE status != payment_status
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log('Orders with mismatched status and payment_status:');
    console.table(result.rows);
    
    // Get the most recent order with mismatched statuses
    if (result.rows.length > 0) {
      const order = result.rows[0];
      console.log('\nMost recent order with mismatched statuses:');
      console.log(`Order ID: ${order.id}`);
      console.log(`Merchant Reference: ${order.merchant_reference}`);
      console.log(`Status: ${order.status}`);
      console.log(`Payment Status: ${order.payment_status}`);
      console.log(`Status Updated At: ${order.status_updated_at}`);
      console.log(`Last Updated: ${order.updated_at}`);
      
      // Get the audit log for this order
      const auditLog = await pool.query(
        `SELECT * FROM order_audit_log 
         WHERE order_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [order.id]
      );
      
      console.log('\nRecent audit log entries:');
      console.table(auditLog.rows.map(entry => ({
        id: entry.id,
        action: entry.action,
        details: JSON.stringify(entry.details),
        created_at: entry.created_at,
        performed_by: entry.performed_by
      })));
    }
    
    // Check the valid values for payment_status
    const enumValues = await pool.query(
      "SELECT unnest(enum_range(NULL::payment_status_enum)) AS status"
    );
    
    console.log('\nValid payment_status values:');
    console.table(enumValues.rows);
    
  } catch (error) {
    console.error('Error checking orders:', error);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkOrders();
