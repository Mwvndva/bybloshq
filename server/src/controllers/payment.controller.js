/**
 * payment.controller.js
 *
 * Delegates payment confirmation to CorePaymentService so payment and order
 * state are updated in one transaction.
 */
import CorePaymentService from '../core/CorePaymentService.js';
import logger from '../shared/utils/logger.js';
import { normalizeOrderInput } from '../shared/utils/order.utils.js';
import paymentService from '../services/payment.service.js';
import LogisticsQuoteService from '../services/logisticsQuote.service.js';

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
      await CorePaymentService.handlePaydWebhook(webhookData, {
        signature: req.headers['x-payd-signature'],
        rawBody: req.rawBody
      });
      logger.info('[PaymentController] Payd webhook processed successfully', {
        transaction_reference: webhookData.transaction_reference
      });
      return res.status(200).json({ received: true });
    } catch (error) {
      logger.error('[PaymentController] Payd webhook processing failed:', {
        transaction_reference: webhookData.transaction_reference,
        error: error.message
      });
      if (
        error.message?.includes('missing valid amount')
        || error.message?.includes('Amount mismatch')
        || error.message?.includes('amount mismatch')
      ) {
        return res.status(200).json({
          received: true,
          processed: false,
          reason: 'verified_provider_payload_rejected'
        });
      }

      const statusCode = error.message?.includes('signature') ? 401 : 500;
      return res.status(statusCode).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Initiate product payment (STK Push).
   */
  async initiateProductPayment(req, res) {
    try {
      logger.info('[PaymentController] Incoming Payment Request: ' + JSON.stringify(req.body));
      const checkoutToken = req.headers['idempotency-key']
        || req.headers['x-checkout-token']
        || req.body.checkout_token
        || req.body.clientCheckoutToken
        || req.body.checkoutAttemptId
        || req.body.idempotencyKey
        || req.body.metadata?.client_checkout_token;

      if (typeof checkoutToken !== 'string' || !checkoutToken.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Checkout idempotency token is required'
        });
      }

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

      res.status(500).json({
        status: 'error',
        message: 'Product payment initiation failed',
        error: error.message
      });
    }
  }

  async quoteLogistics(req, res) {
    try {
      const { legType = 'delivery', location } = req.body;
      const quote = legType === 'pickup'
        ? LogisticsQuoteService.quoteSellerPickup(location)
        : LogisticsQuoteService.quoteBuyerDoorDelivery(location);

      res.status(200).json({
        status: 'success',
        data: quote
      });
    } catch (error) {
      logger.error('[PaymentController] Logistics quote failed:', error);
      res.status(400).json({
        status: 'error',
        message: 'Could not calculate logistics quote',
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
      const result = await paymentService.checkPaymentStatus(paymentId);
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
