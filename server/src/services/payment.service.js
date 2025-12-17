import logger from '../utils/logger.js';
import https from 'https';
import crypto from 'crypto';
import PaymentCompletionService from './paymentCompletion.service.js';
import Payment from '../models/payment.model.js';
import Order from '../models/order.model.js';

class PaymentService {
  async initiatePayment(paymentData) {
    try {
      console.log('=== PAYMENT SERVICE INITIATE PAYMENT ===');
      console.log('Payment data:', paymentData);
      console.log('Timestamp:', new Date().toISOString());
      
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        throw new Error('Paystack secret key not configured');
      }

      // Initialize Paystack transaction
      const initializeData = {
        email: paymentData.email,
        amount: Math.round(parseFloat(paymentData.amount) * 100), // Convert to kobo
        currency: 'KES',
        // Don't send reference - let Paystack generate its own
        // Note: callback_url should point to frontend for user redirect, not webhook
        // Webhook handles payment verification separately
        callback_url: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/payment/success`,
        metadata: {
          invoice_id: paymentData.invoice_id,
          customer_name: `${paymentData.firstName} ${paymentData.lastName}`.trim(),
          narrative: paymentData.narrative,
          phone: paymentData.phone
        }
      };

      const response = await this.makePaystackRequest('POST', '/transaction/initialize', initializeData, paystackSecretKey);
      
      if (response.status && response.data) {
        logger.info('Paystack transaction initialized successfully', {
          reference: response.data.reference,
          authorization_url: response.data.authorization_url,
          fullResponse: response.data
        });
        
        console.log('=== PAYSTACK RESPONSE DEBUG ===');
        console.log('response.data.reference:', response.data.reference);
        console.log('paymentData.invoice_id:', paymentData.invoice_id);
        console.log('==============================');
        
        return {
          invoice_id: paymentData.invoice_id,
          reference: response.data.reference,
          authorization_url: response.data.authorization_url,
          access_code: response.data.access_code,
          status: 'pending',
          message: 'Payment initialized successfully'
        };
      } else {
        throw new Error('Invalid response from Paystack');
      }
      
    } catch (error) {
      logger.error('Error initiating Paystack payment:', error);
      throw error;
    }
  }

  async checkPaymentStatus(paymentId) {
    try {
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        throw new Error('Paystack secret key not configured');
      }

      const response = await this.makePaystackRequest('GET', `/transaction/verify/${paymentId}`, null, paystackSecretKey);
      
      if (response.status && response.data) {
        return {
          state: response.data.status === 'success' ? 'completed' : 'pending',
          status: response.data.status,
          invoice_id: paymentId,
          reference: response.data.reference,
          amount: response.data.amount,
          paid_at: response.data.paid_at,
          message: `Payment ${response.data.status}`
        };
      } else {
        throw new Error('Invalid response from Paystack');
      }
      
    } catch (error) {
      logger.error('Error checking Paystack payment status:', error);
      throw error;
    }
  }

  makePaystackRequest(method, path, data, secretKey) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: path,
        method: method,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async handlePaystackWebhook(webhookData, headers) {
    try {
      // Skip signature verification if webhook secret is not configured (for development)
      const signature = headers['x-paystack-signature'];
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
      
      if (secret && signature) {
        const isValid = this.verifyWebhookSignature(JSON.stringify(webhookData), signature);
        if (!isValid) {
          logger.warn('Invalid webhook signature received');
          // Still process the webhook in development if signature is invalid
        }
      } else if (!secret) {
        logger.info('Webhook secret not configured - skipping signature verification (development mode)');
      }

      const event = webhookData.event;
      const data = webhookData.data;

      logger.info('Paystack webhook received', { event, reference: data.reference });

      // Handle different event types
      switch (event) {
        case 'charge.success':
          return this.handleSuccessfulPayment(data);
        
        case 'charge.failed':
          return this.handleFailedPayment(data);
        
        case 'transfer.success':
          return this.handleSuccessfulTransfer(data);
        
        case 'transfer.failed':
          return this.handleFailedTransfer(data);
        
        default:
          logger.info('Unhandled webhook event', { event });
          return { status: 'ignored', message: `Event ${event} not handled` };
      }

    } catch (error) {
      logger.error('Error processing Paystack webhook:', error);
      throw error;
    }
  }

  verifyWebhookSignature(payload, signature) {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn('Paystack webhook secret not configured');
      return false;
    }

    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');
    return hash === signature;
  }

  handleSuccessfulPayment(data) {
    logger.info('Payment successful', {
      reference: data.reference,
      amount: data.amount,
      customer: data.customer?.email,
      paid_at: data.paid_at
    });

    // Trigger payment completion process
    this.processPaymentCompletion(data);

    return {
      status: 'success',
      event: 'charge.success',
      reference: data.reference,
      amount: data.amount,
      customer: data.customer?.email,
      paid_at: data.paid_at,
      metadata: data.metadata
    };
  }

  handleFailedPayment(data) {
    logger.info('Payment failed', {
      reference: data.reference,
      amount: data.amount,
      customer: data.customer?.email,
      gateway_response: data.gateway_response
    });

    return {
      status: 'failed',
      event: 'charge.failed',
      reference: data.reference,
      amount: data.amount,
      customer: data.customer?.email,
      gateway_response: data.gateway_response,
      metadata: data.metadata
    };
  }

  handleSuccessfulTransfer(data) {
    logger.info('Transfer successful', {
      reference: data.reference,
      amount: data.amount,
      recipient: data.recipient?.name
    });

    return {
      status: 'success',
      event: 'transfer.success',
      reference: data.reference,
      amount: data.amount,
      recipient: data.recipient?.name
    };
  }

  handleFailedTransfer(data) {
    logger.info('Transfer failed', {
      reference: data.reference,
      amount: data.amount,
      recipient: data.recipient?.name
    });

    return {
      status: 'failed',
      event: 'transfer.failed',
      reference: data.reference,
      amount: data.amount,
      recipient: data.recipient?.name
    };
  }

  async processPaymentCompletion(data) {
    try {
      logger.info('=== PAYMENT COMPLETION PROCESS START ===', {
        reference: data.reference,
        amount: data.amount,
        customer: data.customer?.email,
        status: data.status
      });

      // Find payment by Paystack reference
      const payment = await Payment.findByReference(data.reference);
      if (!payment) {
        logger.error('Payment not found for reference:', data.reference);
        return;
      }

      logger.info('Payment found:', {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        currentStatus: payment.status,
        email: payment.email,
        amount: payment.amount,
        metadata: payment.metadata
      });

      // Update payment status to 'success' (Paystack status)
      logger.info('Updating payment status to success...');
      await Payment.updateStatus(payment.invoice_id, 'success', {
        paystack_data: data,
        completed_at: new Date().toISOString()
      });

      logger.info('Payment status updated, checking payment type...');

      // Check if this is a product payment or ticket payment
      const metadata = payment.metadata || {};
      if (metadata.product_id || metadata.order_id) {
        // This is a product payment - process product order
        logger.info('Processing product order completion...');
        await this.processProductOrderCompletion(payment, data);
      } else if (payment.ticket_id || payment.event_id) {
        // This is a ticket payment - process ticket creation
        logger.info('Processing ticket creation...');
        await PaymentCompletionService.processSuccessfulPayment(payment);
      } else {
        logger.warn('Unknown payment type, skipping completion processing');
      }

      logger.info('Payment completion processed successfully', {
        paymentId: payment.id,
        reference: data.reference
      });

    } catch (error) {
      logger.error('Error processing payment completion:', error);
      // Don't throw here to avoid webhook failures
    }
  }

  async processProductOrderCompletion(payment, paystackData) {
    try {
      // Get order from payment metadata
      const metadata = payment.metadata || {};
      let orderId = metadata.order_id;
      
      if (!orderId) {
        logger.error('No order_id found in payment metadata');
        return;
      }

      // Convert orderId to integer to fix type mismatch
      orderId = parseInt(orderId, 10);
      if (isNaN(orderId)) {
        logger.error('Invalid order_id format:', metadata.order_id);
        return;
      }

      // Find the order
      const order = await Order.findById(orderId);
      if (!order) {
        logger.error('Order not found for payment:', orderId);
        return;
      }

      logger.info('Found order for payment completion:', {
        orderId: order.id,
        orderNumber: order.order_number,
        currentStatus: order.status,
        paymentStatus: order.payment_status
      });

      // Update order payment status to 'success' (Paystack status)
      logger.info('Updating payment status for order:', {
        orderId: order.id,
        status: 'success',
        paymentReference: paystackData.reference
      });
      await Order.updatePaymentStatus(order.id, 'success', paystackData.reference);
      
      // Update order status to DELIVERY_PENDING (not 'PROCESSING')
      logger.info('Updating order status to DELIVERY_PENDING for order:', {
        orderId: order.id
      });
      await Order.updateOrderStatus(order.id, 'DELIVERY_PENDING');

      logger.info('Product order payment completed successfully:', {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentReference: paystackData.reference
      });

      // TODO: Send order confirmation email to buyer
      // TODO: Send new order notification to seller
      // TODO: Update seller sales statistics

    } catch (error) {
      logger.error('Error processing product order completion:', error);
      throw error;
    }
  }

  mapPaymentStatus(status) {
    const statusMap = {
      'success': 'completed',
      'completed': 'completed',
      'paid': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'rejected': 'failed',
      'pending': 'pending',
      'processing': 'pending',
      'initiated': 'pending'
    };
    
    return statusMap[status?.toLowerCase()] || 'pending';
  }
}

export default new PaymentService();
