import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkPayment(paymentId) {
  try {
    const query = `
      SELECT id, invoice_id, status, ticket_type_id, event_id, organizer_id, metadata 
      FROM payments 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [paymentId]);
    
    if (result.rows.length === 0) {
      console.log(`No payment found with ID: ${paymentId}`);
      return;
    }
    
    const payment = result.rows[0];
    console.log('Payment details:', JSON.stringify(payment, null, 2));
    
    // Check if ticket_type_id exists in metadata if it's not in the root
    if (!payment.ticket_type_id && payment.metadata?.ticket_type_id) {
      console.log('Found ticket_type_id in metadata:', payment.metadata.ticket_type_id);
    }
    
  } catch (error) {
    console.error('Error checking payment:', error);
  } finally {
    await pool.end();
  }
}

// Get payment ID from command line argument or use default
const paymentId = process.argv[2] || 52;
checkPayment(paymentId);
