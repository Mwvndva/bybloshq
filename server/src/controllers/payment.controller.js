import paymentService from '../services/payment.service.js';
import logger from '../utils/logger.js';
import Payment from '../models/payment.model.js';
import Event from '../models/event.model.js';

class PaymentController {
  /**
   * Handle Paystack webhook
   */
  async handlePaystackWebhook(req, res) {
    try {
      const webhookData = req.body;
      const headers = req.headers;

      logger.info('Paystack webhook received', {
        event: webhookData.event,
        reference: webhookData.data?.reference
      });

      // Process the webhook
      const result = await paymentService.handlePaystackWebhook(webhookData, headers);

      // Return appropriate response
      if (result.status === 'ignored') {
        return res.status(200).json({
          status: 'success',
          message: result.message
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Webhook processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Paystack webhook processing failed:', error);
      
      // Still return 200 to acknowledge receipt (Paystack expects this)
      res.status(200).json({
        status: 'error',
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(req, res) {
    try {
      const testPayload = {
        event: 'charge.success',
        data: {
          reference: 'TEST-' + Date.now(),
          amount: 10000,
          customer: {
            email: 'test@example.com'
          },
          paid_at: new Date().toISOString(),
          metadata: {
            invoice_id: 'test-invoice'
          }
        }
      };

      const testHeaders = {
        'x-paystack-signature': 'test-signature'
      };

      // For testing, skip signature verification
      const result = await paymentService.handleSuccessfulPayment(testPayload.data);

      res.status(200).json({
        status: 'success',
        message: 'Test webhook processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Test webhook failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Test webhook failed',
        error: error.message
      });
    }
  }

  /**
   * Initiate payment
   */
  async initiatePayment(req, res) {
    try {
      console.log('=== TICKET PAYMENT INITIATION ===');
      console.log('Request body:', req.body);
      console.log('Endpoint: /api/payments/initiate');
      const { phone, email, amount, ticketId, eventId } = req.body;
      
      // Get event details to obtain organizer_id
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          status: 'error',
          message: 'Event not found'
        });
      }

      const paymentData = {
        phone,
        email,
        amount,
        invoice_id: `INV-${Date.now()}`,
        firstName: req.body.customerName ? req.body.customerName.split(' ')[0] : 'Customer',
        lastName: req.body.customerName ? req.body.customerName.split(' ').slice(1).join(' ') : '',
        narrative: `Payment for ticket ${ticketId}`,
        ticket_type_id: ticketId,
        event_id: eventId,
        organizer_id: event.organizer_id
      };

      // Create payment record in database first
      const payment = await Payment.create({
        invoice_id: paymentData.invoice_id,
        email: paymentData.email,
        phone_number: paymentData.phone,
        amount: paymentData.amount,
        status: 'pending',
        payment_method: 'paystack',
        ticket_type_id: paymentData.ticket_type_id,
        event_id: paymentData.event_id,
        organizer_id: paymentData.organizer_id,
        metadata: {
          customer_name: `${paymentData.firstName} ${paymentData.lastName}`.trim(),
          narrative: paymentData.narrative
        }
      });

      const result = await paymentService.initiatePayment(paymentData);

      // Update payment record with Paystack reference
      await Payment.update(payment.id, {
        provider_reference: result.reference,
        api_ref: result.reference,
        metadata: {
          ...payment.metadata,
          paystack_response: result
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Payment initiated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Payment initiation failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Payment initiation failed',
        error: error.message
      });
    }
  }

  /**
   * Initiate product payment
   */
  async initiateProductPayment(req, res) {
    try {
      console.log('=== PRODUCT PAYMENT INITIATION ===');
      console.log('Request body:', req.body);
      console.log('Endpoint: /api/payments/initiate-product');
      const { phone, email, amount, productId, sellerId, productName, customerName, narrative } = req.body;
      
      const paymentData = {
        phone,
        email,
        amount,
        invoice_id: `PROD-${Date.now()}`,
        firstName: customerName?.split(' ')[0] || 'Customer',
        lastName: customerName?.split(' ').slice(1).join(' ') || '',
        narrative: narrative || `Payment for product ${productName}`,
        product_id: productId,
        seller_id: sellerId
      };

      const result = await paymentService.initiatePayment(paymentData);

      res.status(200).json({
        status: 'success',
        message: 'Product payment initiated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Product payment initiation failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Product payment initiation failed',
        error: error.message
      });
    }
  }

  /**
   * Check payment status
   */
  async checkStatus(req, res) {
    try {
      const { paymentId } = req.params;
      
      const result = await paymentService.checkPaymentStatus(paymentId);

      res.status(200).json({
        status: 'success',
        message: 'Payment status retrieved successfully',
        data: result
      });

    } catch (error) {
      logger.error('Payment status check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Payment status check failed',
        error: error.message
      });
    }
  }
}

export default new PaymentController();
