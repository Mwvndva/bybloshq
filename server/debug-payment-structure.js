import { pool } from './src/config/database.js';

async function debugPaymentStructure() {
  const client = await pool.connect();
  try {
    console.log('=== PAYMENT STRUCTURE FOR COMPLETED PAYMENT ===');
    const completedPayment = await client.query(`
      SELECT * FROM payments WHERE id = 83
    `);
    
    if (completedPayment.rows.length > 0) {
      const payment = completedPayment.rows[0];
      console.log('Payment object:');
      console.log('- id:', payment.id);
      console.log('- invoice_id:', payment.invoice_id);
      console.log('- email:', payment.email);
      console.log('- amount:', payment.amount);
      console.log('- status:', payment.status);
      console.log('- provider_reference:', payment.provider_reference);
      console.log('- api_ref:', payment.api_ref);
      console.log('- ticket_type_id:', payment.ticket_type_id);
      console.log('- event_id:', payment.event_id);
      console.log('- organizer_id:', payment.organizer_id);
      console.log('- metadata:', payment.metadata);
      
      // Check if ticket type exists
      console.log('\n=== CHECKING TICKET TYPE ===');
      const ticketType = await client.query(`
        SELECT id, name FROM ticket_types WHERE id = $1
      `, [payment.ticket_type_id]);
      console.log('Ticket type:', ticketType.rows);
      
      // Check if event exists
      console.log('\n=== CHECKING EVENT ===');
      const event = await client.query(`
        SELECT id, name FROM events WHERE id = $1
      `, [payment.event_id]);
      console.log('Event:', event.rows);
      
    } else {
      console.log('No completed payment found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugPaymentStructure();
