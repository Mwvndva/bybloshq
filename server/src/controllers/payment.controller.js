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
      const result = await paymentService.initiateProductPayment(req.body, req.user);

      res.status(200).json({
        status: 'success',
        message: 'Product payment initiated. Check your phone.',
        data: result
      });
    } catch (error) {
      logger.error('Product payment initiation failed:', error);

      // Mark order and payment as failed if they were created
      if (error.orderId) {
        try {
          await pool.query(
            `UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1`,
            [error.orderId]
          );
          logger.info(`Order ${error.orderId} marked as FAILED due to payment initiation error`);
        } catch (updateError) {
          logger.error('Failed to update order status:', updateError);
        }
      }

      if (error.paymentId) {
        try {
          await pool.query(
            `UPDATE payments SET status = 'failed' WHERE id = $1`,
            [error.paymentId]
          );
          logger.info(`Payment ${error.paymentId} marked as failed`);
        } catch (updateError) {
          logger.error('Failed to update payment status:', updateError);
        }
      }

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
  /**
   * Check Payd agent status
   */
  async getAgentStatus(req, res) {
    try {
      const status = paymentService.getAgentStatus();
      res.status(200).json({
        status: 'success',
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get agent status:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get agent status',
        error: error.message
      });
    }
  }

  /**
   * Reset Payd agent
   */
  async resetAgent(req, res) {
    try {
      paymentService.resetAgent();
      res.status(200).json({
        status: 'success',
        message: 'Payd HTTPS agent reset successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to reset agent:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to reset agent',
        error: error.message
      });
    }
  }
}

export default new PaymentController();
