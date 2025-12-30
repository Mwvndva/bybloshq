import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import logger from '../utils/logger.js';
import Payment from '../models/payment.model.js';
import Event from '../models/event.model.js';
import jwt from 'jsonwebtoken';
import Order from '../models/order.model.js';

class PaymentController {
  /**
   * Handle Payd webhook
   */
  async handlePaydWebhook(req, res) {
    try {
      const webhookData = req.body;
      const headers = req.headers;

      logger.info('Paystack webhook received', {
        event: webhookData.event,
        reference: webhookData.data?.reference
      });

      // Process the webhook
      // Process the webhook
      // Payd webhook handling
      const result = await paymentService.handlePaydCallback(webhookData);

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
      const { phone, email, ticketId, eventId, quantity = 1, discountCode } = req.body;
      let { amount } = req.body; // Still capture for logging/matching if needed, but we recalculate

      // Get event details to obtain organizer_id
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ status: 'error', message: 'Event not found' });
      }

      // SECURITY: Fetch ticket type and recalculate price on backend
      const { rows: ticketTypes } = await pool.query(
        'SELECT price, name FROM event_ticket_types WHERE id = $1 AND event_id = $2',
        [ticketId, eventId]
      );

      if (ticketTypes.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Ticket type not found' });
      }

      const ticketType = ticketTypes[0];
      let calculatedAmount = parseFloat(ticketType.price) * parseInt(quantity, 10);

      // SECURITY: Verify discount if present
      if (discountCode) {
        const { rows: discounts } = await pool.query(
          'SELECT * FROM discount_codes WHERE code = $1 AND event_id = $2 AND is_active = true',
          [discountCode, eventId]
        );

        if (discounts.length > 0) {
          const discount = discounts[0];
          const discountVal = parseFloat(discount.discount_amount);
          if (discount.discount_type === 'percentage') {
            calculatedAmount = calculatedAmount * (1 - (discountVal / 100));
          } else {
            calculatedAmount = Math.max(0, calculatedAmount - discountVal);
          }
        }
      }

      // Override the amount with our calculated one
      amount = calculatedAmount;

      const paymentData = {
        phone,
        email,
        amount,
        invoice_id: `INV-${Date.now()}`,
        firstName: req.body.customerName ? req.body.customerName.split(' ')[0] : 'Customer',
        lastName: req.body.customerName ? req.body.customerName.split(' ').slice(1).join(' ') : '',
        narrative: `Payment for ${quantity} x ${ticketType.name}`,
        ticket_type_id: ticketId,
        event_id: eventId,
        organizer_id: event.organizer_id,
        quantity: parseInt(quantity, 10)
      };

      // Create payment record in database first
      const payment = await Payment.create({
        invoice_id: paymentData.invoice_id,
        email: paymentData.email,
        phone_number: paymentData.phone,
        amount: paymentData.amount,
        status: 'pending',
        payment_method: 'payd', // Update to payd
        event_id: paymentData.event_id,
        organizer_id: paymentData.organizer_id,
        ticket_type_id: paymentData.ticket_type_id,
        metadata: {
          customer_name: `${paymentData.firstName} ${paymentData.lastName}`.trim(),
          narrative: paymentData.narrative,
          ticket_type_id: paymentData.ticket_type_id,
          quantity: paymentData.quantity,
          discount_code: discountCode || null,
          discount_amount: calculatedAmount - (parseFloat(ticketType.price) * parseInt(quantity, 10)) === 0 ? 0 : Math.abs(calculatedAmount - (parseFloat(ticketType.price) * parseInt(quantity, 10))),
          event_name: event.name,
          event_date: event.start_date,
          event_location: event.location
        }
      });

      // Initiate Payd STK Push
      const result = await paymentService.initiatePayment(paymentData);

      // Update payment record with Payd reference
      await Payment.update(payment.id, {
        provider_reference: result.reference,
        api_ref: result.reference,
        metadata: {
          ...payment.metadata,
          payd_response: result.original_response
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Payment initiated. Please check your phone for the STK prompt.',
        data: {
          ...result,
          message: 'STK Push sent'
        }
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

      // Get buyer info from authenticated user or create guest buyer
      let buyerInfo = null;
      if (req.user && req.user.id) {
        // Authenticated buyer
        buyerInfo = req.user;
      } else {
        // Create or find buyer by phone/email for guest checkout
        // This will be handled by the frontend creating buyer info first
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
          // Decode JWT to get buyer info (simplified - in production, verify token properly)
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            buyerInfo = { id: decoded.id, email, phone };
          } catch (error) {
            console.log('Invalid token, proceeding as guest');
          }
        }
      }

      // Fetch product data to verify price and availability
      const productResult = await pool.query(
        `SELECT p.*, s.status as seller_status 
         FROM products p
         JOIN sellers s ON p.seller_id = s.id
         WHERE p.id = $1`,
        [productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }

      const product = productResult.rows[0];

      // Security Checks
      if (product.seller_status !== 'active') {
        return res.status(400).json({
          status: 'error',
          message: 'This seller is currently not accepting orders'
        });
      }

      if (product.status !== 'available') {
        return res.status(400).json({
          status: 'error',
          message: 'This product is no longer available'
        });
      }

      // STRICT PRICE VERIFICATION
      const dbPrice = parseFloat(product.price);
      const clientAmount = parseFloat(amount);

      if (Math.abs(dbPrice - clientAmount) > 0.01) {
        logger.warn('PRICE MANIPULATION ATTEMPT DETECTED', {
          productId,
          clientAmount,
          dbPrice,
          buyerEmail: email
        });
        return res.status(400).json({
          status: 'error',
          message: 'Price verification failed. Please refresh the page and try again.'
        });
      }

      const orderData = {
        buyerId: buyerInfo?.id || null,
        sellerId: parseInt(product.seller_id),
        paymentMethod: 'payd',
        buyerName: customerName,
        buyerEmail: email,
        buyerPhone: phone,
        metadata: {
          ...(req.body.metadata || {}),
          product_type: product.product_type, // Ensure product type is at top level for notifications
          is_digital: product.is_digital,
          items: [{
            productId: productId,
            name: product.name,
            price: dbPrice,
            quantity: 1,
            subtotal: dbPrice,
            productType: product.product_type,
            isDigital: product.is_digital
          }],
          paymentInitiation: true
        }
      };

      const order = await Order.createOrder(orderData);
      console.log('Created order:', order);

      const paymentData = {
        phone,
        email,
        amount,
        invoice_id: order.id, // Use order ID (integer) as invoice ID
        firstName: customerName?.split(' ')[0] || 'Customer',
        lastName: customerName?.split(' ').slice(1).join(' ') || '',
        narrative: narrative || `Payment for product ${productName}`,
        product_id: productId,
        seller_id: sellerId,
        order_id: order.id, // Link payment to order
        metadata: req.body.metadata // Pass metadata from frontend
      };

      console.log('=== PAYMENT DATA DEBUG ===');
      console.log('order.id:', order.id);
      console.log('order.order_number:', order.order_number);
      console.log('paymentData.invoice_id:', paymentData.invoice_id);
      console.log('========================');

      const result = await paymentService.initiatePayment(paymentData);

      // Create payment record in database
      if (result.reference) {
        const paymentRecord = await Payment.create({
          invoice_id: order.id,
          amount: amount,
          currency: 'KES',
          status: 'pending',
          payment_method: 'payd', // Updated to payd
          phone_number: phone,
          email: email,
          provider_reference: result.reference,
          api_ref: result.reference,
          metadata: {
            ...paymentData,
            order_id: order.id,
            order_number: order.order_number,
            reference: result.reference,
            seller_id: sellerId
          }
        });

        console.log('Payment record created:', paymentRecord);
      }

      res.status(200).json({
        status: 'success',
        message: 'Product payment initiated. Check your phone.',
        data: {
          ...result,
          order_id: order.id,
          order_number: order.order_number
        }
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
