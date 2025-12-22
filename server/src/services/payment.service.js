import logger from '../utils/logger.js';
import https from 'https';
import crypto from 'crypto';
import PaymentCompletionService from './paymentCompletion.service.js';
import Payment from '../models/payment.model.js';
import Order from '../models/order.model.js';
import { pool } from '../config/database.js';
import {
  sendProductOrderConfirmationEmail,
  sendNewOrderNotificationEmail
} from '../utils/email.js';
import whatsappService from './whatsapp.service.js';

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
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
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

  async handlePaystackWebhook(webhookData, headers, clientIp) {
    try {
      // Paystack official webhook IP addresses
      const paystackIps = ['52.31.139.75', '52.49.173.169', '52.214.14.220'];

      // Verification of IP address
      if (clientIp) {
        // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:127.0.0.1)
        const normalizedIp = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp;

        if (!paystackIps.includes(normalizedIp)) {
          if (process.env.NODE_ENV === 'production') {
            logger.warn('Webhook received from unauthorized IP in PRODUCTION:', {
              clientIp,
              normalizedIp,
              expected: paystackIps
            });
            // We log but DON'T block yet to avoid breaking valid flows 
            // especially if proxies still mask things
          } else {
            logger.info('Webhook received from non-Paystack IP (Development/Test):', { normalizedIp });
          }
        } else {
          logger.info('Webhook IP verified successfully', { normalizedIp });
        }
      }

      // Skip signature verification ONLY if webhook secret is not configured (for development)
      const signature = headers['x-paystack-signature'];
      // Use PAYSTACK_WEBHOOK_SECRET if exists, otherwise fallback to PAYSTACK_SECRET_KEY
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;

      if (!signature) {
        logger.warn('Webhook received without signature');
        throw new Error('Signature required');
      }

      if (secret) {
        const isValid = this.verifyWebhookSignature(JSON.stringify(webhookData), signature);
        if (!isValid) {
          logger.error('Invalid webhook signature received - POSSIBLE TAMPERING');
          throw new Error('Invalid signature');
        }
      } else {
        logger.warn('No secret configured for webhook validation (PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY)');
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Webhook secret mandatory in production');
        }
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
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      logger.warn('Paystack secret not configured for verification');
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
      logger.info('Payment type check details:', {
        hasTicketId: !!payment.ticket_id,
        hasEventId: !!payment.event_id,
        hasProductId: !!metadata.product_id,
        hasOrderId: !!metadata.order_id,
        paymentId: payment.id,
        ticket_id_val: payment.ticket_id,
        event_id_val: payment.event_id
      });

      if (metadata.product_id || metadata.order_id) {
        // This is a product payment - process product order
        logger.info('Processing product order completion...');
        await this.processProductOrderCompletion(payment, data);
      } else if (payment.ticket_id || payment.event_id) {
        // This is a ticket payment - process ticket creation
        logger.info('Triggering PaymentCompletionService.processSuccessfulPayment...');
        await PaymentCompletionService.processSuccessfulPayment(payment);
      } else {
        logger.warn('Unknown payment type - neither product nor ticket fields found!', {
          metadata: JSON.stringify(metadata),
          payment: JSON.stringify(payment)
        });
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
    const client = await pool.connect();
    try {
      // Use a transaction with advisory lock to prevent race conditions
      await client.query('BEGIN');

      // Get order from payment metadata
      const metadata = payment.metadata || {};
      let orderId = metadata.order_id;

      if (!orderId) {
        logger.error('No order_id found in payment metadata');
        await client.query('ROLLBACK');
        return;
      }

      orderId = parseInt(orderId, 10);
      if (isNaN(orderId)) {
        logger.error('Invalid order_id format:', metadata.order_id);
        await client.query('ROLLBACK');
        return;
      }

      // 1. ADVISORY LOCK (Conccurency Protection)
      // Use a lock specific to product orders to avoid interfering with tickets
      const lockId = 200000 + orderId; // Offset to avoid collisions
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

      // 2. FIND ORDER (Inside transaction) - Join with sellers for notifications
      const orderQuery = `
        SELECT o.*, s.email as seller_email, s.full_name as seller_name, s.phone as seller_phone
        FROM product_orders o
        JOIN sellers s ON o.seller_id = s.id
        WHERE o.id = $1 FOR UPDATE
      `;
      const { rows } = await client.query(orderQuery, [orderId]);
      const order = rows[0];

      if (!order) {
        logger.error('Order not found for payment:', orderId);
        await client.query('ROLLBACK');
        return;
      }

      // Fetch order items with product details to check if they are digital
      const itemsQuery = `
        SELECT oi.*, p.is_digital
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await client.query(itemsQuery, [orderId]);
      order.items = itemsResult.rows;

      if (order.payment_status === 'success' || order.payment_status === 'completed') {
        logger.info('Order already processed, skipping', { orderId: order.id });
        await client.query('ROLLBACK');
        return;
      }

      // Check if all items are digital
      const allDigital = order.items.length > 0 && order.items.every(item => item.is_digital);
      const newStatus = allDigital ? 'COMPLETED' : 'DELIVERY_PENDING';

      logger.info(`Order type check: ${allDigital ? 'All Digital' : 'Physical/Mixed'} -> Status: ${newStatus}`, { orderId: order.id });

      // 3. POST-PAYMENT AUDIT (Integrity Check)
      const paidAmount = parseFloat(paystackData.amount) / 100; // Paystack sends in kobo/cents
      const expectedAmount = parseFloat(order.total_amount);

      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        logger.error('CRITICAL: Payment amount mismatch for product order!', {
          orderId: order.id,
          expected: expectedAmount,
          paid: paidAmount,
          reference: paystackData.reference
        });

        // Update order with audit failure info but don't mark as successful delivery
        await client.query(
          `UPDATE product_orders 
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{audit_error}', $1::jsonb),
               payment_status = 'audit_failed'
           WHERE id = $2`,
          [JSON.stringify({
            error: 'Amount mismatch',
            expected: expectedAmount,
            paid: paidAmount,
            timestamp: new Date().toISOString()
          }), order.id]
        );

        await client.query('COMMIT');
        return;
      }

      logger.info('Audit passed. Updating payment status for order:', {
        orderId: order.id,
        status: 'success',
        paymentReference: paystackData.reference
      });

      // 4. UPDATE ORDER STATUS
      await client.query(
        `UPDATE product_orders 
         SET payment_status = $1,
             payment_reference = $2,
             paid_at = NOW(),
             status = $3,
             updated_at = NOW()
         WHERE id = $4`,
        ['success', paystackData.reference, newStatus, order.id]
      );

      // 5. UPDATE SELLER STATISTICS
      logger.info('Updating seller financial statistics...', { sellerId: order.seller_id });
      await client.query(
        `UPDATE sellers 
         SET total_sales = total_sales + 1,
             net_revenue = net_revenue + $1,
             balance = balance + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [order.total_amount, order.seller_payout_amount, order.seller_id]
      );

      await client.query('COMMIT');

      logger.info('Product order payment completed successfully:', {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentReference: paystackData.reference
      });

      // 5. TRIGGER EMAIL NOTIFICATIONS
      try {
        logger.info('Sending product order confirmation emails...', { orderId: order.id });

        // Send to buyer
        await sendProductOrderConfirmationEmail(order.buyer_email, order);

        // Send to seller
        if (order.seller_email) {
          await sendNewOrderNotificationEmail(order.seller_email, order);
        }

        logger.info('Product order notification emails sent successfully');

        // 6. TRIGGER WHATSAPP NOTIFICATIONS
        if (whatsappService.isClientReady && whatsappService.isClientReady()) {
          logger.info('Sending WhatsApp notifications...', { orderId: order.id });

          // Notify Seller
          await whatsappService.notifySellerNewOrder({
            seller: {
              phone: order.seller_phone,
              full_name: order.seller_name
            },
            order: {
              orderNumber: order.order_number,
              totalAmount: order.total_amount
            },
            items: order.items
          });

          // Notify Buyer
          await whatsappService.notifyBuyerOrderConfirmation({
            buyer: {
              phone: order.buyer_phone,
              full_name: order.buyer_name
            },
            order: {
              orderNumber: order.order_number,
              totalAmount: order.total_amount
            },
            items: order.items
          });

          // Notify Logistics
          await whatsappService.sendLogisticsNotification(
            order,
            {
              phone: order.buyer_phone,
              fullName: order.buyer_name,
              city: order.shipping_address?.city, // Assuming address is JSON
              location: order.shipping_address?.street || order.shipping_address?.location
            },
            {
              phone: order.seller_phone,
              shop_name: order.seller_name
            }
          );
        } else {
          logger.warn('WhatsApp service not ready, skipping notifications');
        }

      } catch (emailError) {
        logger.error('Error triggering product order notifications:', emailError);
        // Don't throw here as the database update was successful
      }

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logger.error('Error processing product order completion:', error);
      throw error;
    } finally {
      client.release();
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
