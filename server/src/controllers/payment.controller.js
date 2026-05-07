/**
 * payment.controller.js
 *
 * Delegates payment confirmation to CorePaymentService so payment and order
 * state are updated in one transaction.
 */
import CorePaymentService from '../core/CorePaymentService.js';
import logger from '../shared/utils/logger.js';
import { pool } from '../shared/db/database.js';
import { normalizeOrderInput } from '../shared/utils/order.utils.js';
import paymentService from '../services/payment.service.js';

class PaymentController {
  /**
   * Handle Payd STK Push webhook (payment confirmation).
   */
  async handlePaydWebhook(req, res) {
    const webhookData = req.body;

    logger.info('[PaymentController] Payd webhook received', {
      transaction_reference: webhookData.transaction_reference || webhookData.data?.api_ref,
      result_code: webhookData.result_code,
      success: webhookData.success,
    });

    try {
      await CorePaymentService.handlePaydWebhook(webhookData);
      logger.info('[PaymentController] Payd webhook processed successfully', {
        transaction_reference: webhookData.transaction_reference
      });
      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('[PaymentController] Payd webhook processing failed:', {
        transaction_reference: webhookData.transaction_reference,
        error: error.message
      });
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Initiate product payment (STK Push).
   */
  async initiateProductPayment(req, res) {
    try {
      logger.info('[PaymentController] Incoming Payment Request: ' + JSON.stringify(req.body));
      const normalizedOrder = await normalizeOrderInput(req);

      logger.info('[PaymentController] Product payment initiation', {
        orderId: normalizedOrder.service.id,
        buyer: normalizedOrder.buyer.name,
        total: normalizedOrder.service.total
      });

      const result = await paymentService.initiateProductPayment(normalizedOrder);

      res.status(200).json({
        status: 'success',
        message: 'Product payment initiated. Check your phone.',
        data: result
      });
    } catch (error) {
      logger.error('[PaymentController] Product payment initiation failed:', error);

      if (error.orderId) {
        await pool.query(
          `UPDATE product_orders SET status = 'FAILED', payment_status = 'failed' WHERE id = $1`,
          [error.orderId]
        ).catch(e => logger.error('[PaymentController] Failed to mark order as failed:', e));
      }

      if (error.paymentId) {
        await pool.query(
          `UPDATE payments SET status = 'failed' WHERE id = $1`,
          [error.paymentId]
        ).catch(e => logger.error('[PaymentController] Failed to mark payment as failed:', e));
      }

      res.status(500).json({
        status: 'error',
        message: 'Product payment initiation failed',
        error: error.message
      });
    }
  }

  /**
   * Check payment status.
   */
  async checkStatus(req, res) {
    try {
      const { paymentId } = req.params;
      const result = await CorePaymentService.checkPaymentStatus(paymentId);
      res.status(200).json({
        status: 'success',
        message: 'Payment status retrieved successfully',
        data: result
      });
    } catch (error) {
      logger.error('[PaymentController] Payment status check failed:', error);
      res.status(500).json({
        status: 'error',
        message: 'Payment status check failed',
        error: error.message
      });
    }
  }

  async getAgentStatus(req, res) {
    try {
      const status = paymentService.getAgentStatus();
      res.status(200).json({ status: 'success', data: status, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('[PaymentController] Failed to get agent status:', error);
      res.status(500).json({ status: 'error', message: 'Failed to get agent status', error: error.message });
    }
  }

  async resetAgent(req, res) {
    try {
      paymentService.resetAgent();
      res.status(200).json({ status: 'success', message: 'Payd HTTPS agent reset successfully', timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('[PaymentController] Failed to reset agent:', error);
      res.status(500).json({ status: 'error', message: 'Failed to reset agent', error: error.message });
    }
  }

  async checkNetwork(req, res) {
    try {
      const results = await paymentService.getNetworkStatus();
      res.status(200).json({ status: 'success', data: results, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('[PaymentController] Network check failed:', error);
      res.status(500).json({ status: 'error', message: 'Network check failed', error: error.message });
    }
  }
}

export default new PaymentController();
