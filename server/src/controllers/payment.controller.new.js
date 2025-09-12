import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import PaymentCompletionService from '../services/paymentCompletion.service.js';
import { v4 as uuidv4 } from 'uuid';

class PaymentController {
  /**
   * Format and validate phone number for M-Pesa
   */
  formatPhoneNumber(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '254' + digits.substring(1);
    if (digits.startsWith('254')) return digits;
    if (digits.length === 9 && /^[17]/.test(digits)) return '254' + digits;
    throw new Error('Invalid phone number format. Please use a valid Kenyan number (e.g., 0712345678 or 254712345678)');
  }

  /**
   * Format payment response consistently
   */
  formatPaymentResponse(payment) {
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      ticketId: payment.ticket_id,
      eventId: payment.event_id,
      ticketTypeId: payment.ticket_type_id,
      userId: payment.user_id,
      providerReference: payment.provider_reference,
      invoiceId: payment.invoice_id,
      metadata: payment.metadata,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at
    };
  }

  /**
   * Create a ticket for a completed payment
   */
  async createTicketForPayment(client, payment) {
    try {
      // Get ticket type details
      const ticketType = await client.query(
        'SELECT * FROM ticket_types WHERE id = $1',
        [payment.ticket_type_id]
      );

      if (!ticketType.rows.length) {
        throw new Error('Ticket type not found');
      }

      // Generate a unique ticket code
      const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      
      // Create ticket
      const ticket = await client.query(
        `INSERT INTO tickets (
          code, status, ticket_type_id, event_id, user_id, 
          payment_id, price, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          ticketCode,
          'active',
          payment.ticket_type_id,
          payment.event_id,
          payment.user_id,
          payment.id,
          payment.amount
        ]
      );

      // Update payment with ticket ID
      await client.query(
        'UPDATE payments SET ticket_id = $1, updated_at = NOW() WHERE id = $2',
        [ticket.rows[0].id, payment.id]
      );

      logger.info(`Created ticket ${ticket.rows[0].id} for payment ${payment.id}`);
      return ticket.rows[0];
      
    } catch (error) {
      logger.error('Error creating ticket for payment:', {
        error: error.message,
        paymentId: payment.id,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Map provider status to our internal status
   */
  mapPaymentStatus(providerStatus) {
    const statusMap = {
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'AWAITING_AUTH': 'pending',
      'AWAITING_CONFIRMATION': 'pending',
      'COMPLETED': 'completed',
      'COMPLETE': 'completed',
      'SUCCESS': 'completed',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',
      'ERROR': 'failed',
      'DECLINED': 'failed',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'cancelled',
      'REVERSED': 'refunded',
      'REFUNDED': 'refunded',
      'UNKNOWN': 'pending',
      'SUBMITTED': 'pending',
      'SETTLED': 'completed',
      'PENDING_CONFIRMATION': 'pending'
    };
    
    const normalizedStatus = (providerStatus || '').toUpperCase().trim();
    return statusMap[normalizedStatus] || 'pending';
  }

  /**
   * Check payment status - Simplified version
   * @route GET /api/payments/status/:paymentId
   */
  checkStatus = async (req, res) => {
    const { paymentId } = req.params;
    const client = await pool.connect();
    
    try {
      // 1. Get payment from database
      const payment = await client.query(
        'SELECT * FROM payments WHERE id = $1 OR invoice_id = $1 LIMIT 1',
        [paymentId]
      );

      if (!payment.rows.length) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
      }

      const currentPayment = payment.rows[0];
      
      // 2. If already completed, return immediately
      if (currentPayment.status === 'completed') {
        return res.json({
          success: true,
          status: 'completed',
          payment: this.formatPaymentResponse(currentPayment)
        });
      }

      // 3. Check with payment provider if still pending/processing
      if (['pending', 'processing'].includes(currentPayment.status)) {
        try {
          const reference = currentPayment.provider_reference || currentPayment.invoice_id;
          const providerStatus = await paymentService.checkPaymentStatus(reference);
          const newStatus = this.mapPaymentStatus(providerStatus.state || providerStatus.status);
          
          // 4. Update status if changed or if completed
          if (newStatus !== currentPayment.status || newStatus === 'completed') {
            // Start transaction for the update
            await client.query('BEGIN');
            
            // Update the payment status
            await client.query(
              `UPDATE payments 
               SET status = $1, 
                   updated_at = NOW(),
                   provider_reference = COALESCE($2, provider_reference)
               WHERE id = $3`,
              [
                newStatus,
                providerStatus.mpesa_reference || currentPayment.provider_reference,
                currentPayment.id
              ]
            );
            
            // 5. Create ticket if completed
            if (newStatus === 'completed' && !currentPayment.ticket_id) {
              await this.createTicketForPayment(client, currentPayment);
            }
            
            await client.query('COMMIT');
            
            // Update the current payment object
            currentPayment.status = newStatus;
          }
          
        } catch (error) {
          logger.error('Error checking payment status with provider:', {
            error: error.message,
            paymentId: currentPayment.id,
            stack: error.stack
          });
          // Continue with current status if provider check fails
        }
      }

      // 6. Get final payment data
      const finalPayment = await client.query(
        'SELECT * FROM payments WHERE id = $1',
        [currentPayment.id]
      );

      return res.json({
        success: true,
        status: finalPayment.rows[0].status,
        payment: this.formatPaymentResponse(finalPayment.rows[0])
      });

    } catch (error) {
      logger.error('Error in checkStatus:', {
        error: error.message,
        stack: error.stack,
        paymentId
      });
      
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to check payment status',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  }

  // ... (keep other methods as they are)
  
  // Placeholder for other methods to maintain compatibility
  initiatePayment = async (req, res) => {
    // Implementation remains the same as before
  };
  
  handleWebhook = async (req, res) => {
    // Implementation remains the same as before
  };
}

export default new PaymentController();
