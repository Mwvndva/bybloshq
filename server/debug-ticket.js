import { pool } from './src/config/database.js';

async function debugTicketCreation() {
  const client = await pool.connect();
  try {
    console.log('=== RECENT PAYMENTS ===');
    const recentPayments = await client.query(`
      SELECT id, invoice_id, email, amount, status, provider_reference, api_ref, 
             ticket_type_id, event_id, organizer_id, metadata, created_at
      FROM payments 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.table(recentPayments.rows);
    
    console.log('\n=== RECENT TICKETS ===');
    const recentTickets = await client.query(`
      SELECT id, ticket_number, customer_email, payment_id, status, created_at
      FROM tickets 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.table(recentTickets.rows);
    
    console.log('\n=== PAYMENT-TICKET RELATIONSHIP ===');
    const paymentTicketRelation = await client.query(`
      SELECT 
        p.id as payment_id,
        p.invoice_id,
        p.status as payment_status,
        p.provider_reference,
        p.api_ref,
        t.id as ticket_id,
        t.ticket_number,
        t.status as ticket_status,
        t.payment_id as ticket_payment_id
      FROM payments p
      LEFT JOIN tickets t ON t.payment_id = p.id OR t.metadata->>'payment_id' = p.id::text
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    console.table(paymentTicketRelation.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

debugTicketCreation();
