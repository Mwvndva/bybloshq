/**
 * payment.controller.js
 *
 * Delegates payment confirmation to CorePaymentService so payment and order
 * state are updated in one transaction.
 */
import CorePaymentService from './CorePaymentService.js';
import logger from '../../../shared/utils/logger.js';
import { normalizeOrderInput } from '../../../shared/utils/order.utils.js';
import paymentService from './payment.service.js';
import LogisticsQuoteService from '../../logistics/logisticsQuote.service.js';

class PaymentController {
  /**
   * Handle Paystack M-Pesa charge webhook.
   */
  async handlePaystackWebhook(req, res) {
    const webhookData = req.body;
    const data = webhookData.data || webhookData || {};
    const security = req.webhookSecurity || {};

    logger.info('[PaymentController] Paystack webhook received', {
      event: webhookData.event,
      reference: data.reference,
      status: data.status,
    });

    // Process the webhook BEFORE acknowledging. Acking 200 first and processing
    // in setImmediate meant a failed completion (DB/transient error) was only
    // logged — Paystack, already 200'd, never retried, so a charged buyer's order
    // could be permanently stranded in `pending` (and the replay-dedupe key was
    // marked completed off the already-sent 200, swallowing any retry). Paystack's
    // timeout budget comfortably covers a single settlement transaction.
    try {
      await CorePaymentService.handlePaystackWebhook(webhookData, {
        signature: req.headers['x-paystack-signature'],
        rawBody: req.rawBody,
        replayEventId: security.replayEventId,
        hmacVerified: security.hmacVerified === true
      });
      return res.status(200).json({ status: 'success', message: 'Webhook processed' });
    } catch (error) {
      logger.error('[PAYSTACK_WEBHOOK] Error completing payment:', {
        reference: data.reference,
        eventId: security.replayEventId,
        error: error.message
      });
      // Return 5xx so Paystack retries; never silently strand a paid order.
      return res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
    }
  }

  /**
   * Initiate product payment (STK Push).
   */
  async initiateProductPayment(req, res) {
    try {
      // Never log the full body — it contains buyer PII (email, phone, address).
      logger.info('[PaymentController] Incoming Payment Request', {
        productId: req.body?.productId,
        quantity: req.body?.quantity,
        hasEmail: !!req.body?.email,
        hasPhone: !!(req.body?.phone || req.body?.mobilePayment),
        doorDelivery: !!(req.body?.delivery?.doorDelivery || req.body?.delivery?.door_delivery),
      });
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

      // Do not report an explicitly-rejected charge as success (the buyer must
      // not be told "check your phone" for a payment that was declined).
      if (result && result.failed) {
        return res.status(402).json({
          status: 'failed',
          message: 'Payment could not be initiated. Please try again.',
          data: result
        });
      }

      res.status(200).json({
        status: 'success',
        message: result && result.pending
          ? 'Payment request received; awaiting confirmation.'
          : 'Product payment initiated. Check your phone.',
        data: result
      });
    } catch (error) {
      logger.error('[PaymentController] Product payment initiation failed:', error);
      const clientErrorMessages = [
        'Checkout idempotency token is required',
        'Product not found',
        'Seller is not accepting orders',
        'Custom product is misconfigured. Please contact the seller.',
        'Customization instructions are required for this custom product.',
        'Imported product is misconfigured. Please contact the seller.',
        'Product cannot be both custom and imported.',
        'Door delivery is only available for physical products.',
        'Door delivery address is required.',
        'Door delivery coordinates are required.',
        'Invalid order amount after secure calculation',
        'Product not available',
        'Insufficient stock available'
      ];
      const statusCode = clientErrorMessages.includes(error.message) ? 400 : 500;

      res.status(statusCode).json({
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
      // This endpoint is PUBLIC (guest checkout polls it). Never return the full
      // payment row — that leaks buyer PII (email/phone/receipts/raw provider
      // payload). Expose only a minimal, non-sensitive status projection.
      const meta = result && typeof result.metadata === 'object' ? result.metadata : {};
      const safe = result
        ? {
            status: result.status ?? null,
            orderNumber: meta.order_number ?? result.invoice_id ?? null,
            amount: result.amount ?? null,
            currency: result.currency ?? 'KES',
            reference: result.provider_reference ?? result.api_ref ?? null,
          }
        : null;
      res.status(200).json({
        status: 'success',
        message: 'Payment status retrieved successfully',
        data: safe
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
      res.status(200).json({ status: 'success', message: 'Payment provider HTTPS agent reset successfully', timestamp: new Date().toISOString() });
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
