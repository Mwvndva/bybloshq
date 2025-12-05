import { pool } from './src/config/database.js';
import PaymentCompletionService from './src/services/paymentCompletion.service.js';
import logger from './src/utils/logger.js';

async function manualTestCompletion() {
  try {
    // Get the completed payment
    const paymentResult = await pool.query(`
      SELECT * FROM payments WHERE id = 83
    `);
    
    if (paymentResult.rows.length === 0) {
      console.log('No completed payment found');
      return;
    }
    
    const payment = paymentResult.rows[0];
    console.log('Found payment:', {
      id: payment.id,
      invoice_id: payment.invoice_id,
      status: payment.status,
      email: payment.email,
      amount: payment.amount
    });
    
    console.log('Manually triggering payment completion...');
    
    // Manually trigger the completion process
    const result = await PaymentCompletionService.processSuccessfulPayment(payment);
    
    console.log('Completion result:', result);
    
  } catch (error) {
    console.error('Manual test failed:', error);
  } finally {
    await pool.end();
  }
}

manualTestCompletion();
