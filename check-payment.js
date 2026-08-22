import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'byblos',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function checkPayment(paymentId) {
  try {
    const query = `
      SELECT 
        id, 
        invoice_id, 
        status, 
        ticket_type_id, 
        ticket_id, 
        event_id, 
        organizer_id, 
        amount, 
        metadata 
      FROM payments 
      WHERE id = $1`;
      
    const result = await pool.query(query, [paymentId]);
    
    if (result.rows.length === 0) {
      console.log(`No payment found with ID: ${paymentId}`);
      return;
    }
    
    const payment = result.rows[0];
    console.log('Payment Details:');
    console.log('----------------');
    console.log(`ID: ${payment.id}`);
    console.log(`Invoice ID: ${payment.invoice_id}`);
    console.log(`Status: ${payment.status}`);
    console.log(`Ticket Type ID: ${payment.ticket_type_id}`);
    console.log(`Ticket ID: ${payment.ticket_id}`);
    console.log(`Event ID: ${payment.event_id}`);
    console.log(`Organizer ID: ${payment.organizer_id}`);
    console.log(`Amount: ${payment.amount}`);
    console.log('Metadata:', JSON.stringify(payment.metadata, null, 2));
    
    // Check if we have all required fields for ticket creation
    const missingFields = [];
    if (!payment.ticket_type_id) missingFields.push('ticket_type_id');
    if (!payment.event_id) missingFields.push('event_id');
    if (!payment.organizer_id) missingFields.push('organizer_id');
    
    if (missingFields.length > 0) {
      console.log('\nMissing required fields for ticket creation:', missingFields.join(', '));
    } else {
      console.log('\nAll required fields for ticket creation are present');
    }
    
  } catch (error) {
    console.error('Error checking payment:', error);
  } finally {
    await pool.end();
  }
}

// Get payment ID from command line argument or use default (25)
const paymentId = process.argv[2] || 25;
checkPayment(paymentId);
