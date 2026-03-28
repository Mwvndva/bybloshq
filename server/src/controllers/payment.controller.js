import { pool } from '../config/database.js';
import paymentService from '../services/payment.service.js';
import logger from '../utils/logger.js';
import Payment from '../models/payment.model.js';
import jwt from 'jsonwebtoken';
import Order from '../models/order.model.js';
import OrderService from '../services/order.service.js';
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

      logger.info('[PAYD-WEBHOOK] Received webhook request', {
        ip: req.ip,
        reference: (webhookData.data || webhookData).transaction_reference || (webhookData.data || webhookData).reference
      });

      // 1. Respond 200 immediately to acknowledge receipt (Payd Best Practice)
      res.status(200).json({ received: true, status: 'success' });

      // 2. Process asynchronously in the background
      (async () => {
        try {
          const result = await paymentService.handlePaydCallback(webhookData);
          logger.info('[PAYD-WEBHOOK] Background processing completed', {
            reference: result.reference || result.payment_id,
            status: result.status
          });
        } catch (error) {
          logger.error('[PAYD-WEBHOOK] Background processing failed:', error);
        }
      })();

    } catch (error) {
      logger.error('[PAYD-WEBHOOK] Critical controller error:', error);
      if (!res.headersSent) {
        res.status(200).json({ status: 'error', message: 'Accepted with processing error' });
      }
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
