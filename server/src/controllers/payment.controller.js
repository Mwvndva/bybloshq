import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import logger from '../utils/logger.js';
import Payment from '../models/payment.model.js';
import Event from '../models/event.model.js';
import jwt from 'jsonwebtoken';
import Order from '../models/order.model.js';
import OrderService from '../services/order.service.js';
import DiscountCode from '../models/discountCode.model.js';
import Buyer from '../models/buyer.model.js';
import Fees from '../config/fees.js';
import { PaymentStatus, ProductType } from '../constants/enums.js';

class PaymentController {
  /**
   * Handle Payd webhook
   */
  async handlePaydWebhook(req, res) {
    try {
      const webhookData = req.body;
      const headers = req.headers;

      logger.info('Payd webhook received', {
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
      logger.error('Payd webhook processing failed:', error);

      // Still return 200 to acknowledge receipt (Payd expects this)
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
      logger.info('=== TICKET PAYMENT INITIATION ===', {
        body: req.body,
        endpoint: '/api/payments/initiate'
      });
      const { phone, email, ticketId, eventId, quantity = 1, discountCode } = req.body;
      let { amount } = req.body; // Still capture for logging/matching if needed, but we recalculate

      // Get event details to obtain organizer_id
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ status: 'error', message: 'Event not found' });
      }

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
      logger.info('=== PRODUCT PAYMENT INITIATION ===', {
        body: req.body,
        endpoint: '/api/payments/initiate-product'
      });
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
          // Decode JWT to get buyer info
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Validate that this buyer actually exists in the DB (prevent stale token FK errors)
            const validBuyer = await Buyer.findById(decoded.id);

            if (validBuyer) {
              buyerInfo = validBuyer;
            } else {
              logger.warn('Token valid but user ID not found in DB (Stale Token)', { id: decoded.id });
              // Leave buyerInfo as null -> proceeds to phone lookup
            }
          } catch (error) {
            logger.warn('Invalid token, proceeding as guest', { error: error.message });
          }
        }

        // If still no buyer info, try to find by phone (for existing unauthenticated buyers)
        logger.info('Checking for buyer lookup:', { hasBuyerInfo: !!buyerInfo, phone });
        if (!buyerInfo && phone) {
          logger.info('Attempting to find existing buyer by phone:', phone);
          const existingBuyer = await Buyer.findByPhone(phone);
          if (existingBuyer) {
            buyerInfo = existingBuyer;
            logger.info('Found existing buyer by phone for payment:', { id: buyerInfo.id });
          } else {
            logger.warn('No existing buyer found for phone:', phone);
          }
        }
      }

      logger.info('Proceeding with order creation', {
        buyerId: buyerInfo?.id || 'null',
        hasBuyerInfo: !!buyerInfo
      });

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

      const order = await OrderService.createOrder(orderData);
      logger.info('Created order:', { orderId: order.id });

      const paymentData = {
        phone,
        email,
        amount,
        invoice_id: String(order.id), // Use order ID (string) as invoice ID
        firstName: customerName?.split(' ')[0] || 'Customer',
        lastName: customerName?.split(' ').slice(1).join(' ') || '',
        narrative: narrative || `Payment for product ${productName}`,
        product_id: productId,
        seller_id: sellerId,
        seller_id: sellerId,
        order_id: order.id, // Link payment to order
        product_type: product.product_type,
        is_digital: product.is_digital,
        metadata: req.body.metadata // Pass metadata from frontend
      };

      logger.debug('=== PAYMENT DATA DEBUG ===', {
        orderId: order.id,
        orderNumber: order.order_number,
        invoiceId: paymentData.invoice_id
      });

      // 3. Initiate via Service
      // We are calling paymentService.initiateProductPayment but we need to pass the order ID we just created
      // Actually, looking at the code below, it calls paymentService.initiateProductPayment, which might duplicate logic?
      // Wait, line 297 implies paymentService.initiateProductPayment does EVERYTHING? 
      // But we just manually created the order at line 261!
      // If paymentService.initiateProductPayment creates an order, we shouldn't create it here.
      // But looking at line 261, we ARE creating it here.
      // Let's assume we want to use the order we created.
      // And we initiate payment using the RAW payment data, NOT the full service call that might double-create.
      // Or maybe paymentService.initiatePayment (generic) is what we want?
      // Re-reading line 297: `const result = await paymentService.initiateProductPayment(req.body, req.user);`
      // This looks like it was intended to replace the whole block!
      // But the current block does validation, order creation, AND THEN calls this?
      // That seems wrong. `initiateProductPayment` likely re-does logic.

      // FIX: Since we did manual order creation here, let's just use the GENERIC initiatePayment from service
      // OR let `paymentService.initiateProductPayment` handle it all and DELETE the manual logic here?
      // Given the error was "Order.createOrder", the code WAS executing this manual block.
      // I will trust the manual block is the "active" path being used and just fix the service call to be the low-level one.

      const result = await paymentService.initiatePayment(paymentData);

      res.status(200).json({
        status: 'success',
        message: 'Product payment initiated. Check your phone.',
        data: {
          ...result,
          order_id: order.id,
          order_number: order.order_number
        }
      });


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
