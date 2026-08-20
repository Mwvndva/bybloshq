import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import { PaymentStatus, OrderStatus } from '../../shared/constants/enums.js';
import PaymentService from '../../domains/payments/payments/payment.service.js';
import OrderService from '../../domains/orders/order/OrderService.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

export class PaymentWebhookWorkflow {
  static async handleSuccessfulPayment(paymentReference, providerPayload) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. FOR UPDATE Row Lock on Payment
      const payRes = await client.query(
        'SELECT * FROM payments WHERE reference = $1 OR provider_reference = $1 FOR UPDATE',
        [paymentReference]
      );
      if (payRes.rows.length === 0) {
        throw new Error('Payment reference not found');
      }
      const payment = payRes.rows[0];

      if (payment.status === PaymentStatus.SUCCESSFUL) {
        await client.query('COMMIT');
        return { success: true, duplicate: true, payment };
      }

      // 2. Update Payment Status to SUCCESSFUL
      const updatedPayment = await PaymentService._updatePaymentOnSuccess(client, payment.id, providerPayload);

      // 3. Synchronous Order Status Transition to PAID inside SQL Tx
      const orderRes = await client.query(
        'UPDATE orders SET status = $1, paid_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
        [OrderStatus.PAID, payment.order_id]
      );
      const updatedOrder = orderRes.rows[0];

      await client.query('COMMIT');

      // 4. Post-Commit Async Event Emission
      try {
        eventBus.emit(AppEvents.PAYMENT_SUCCESSFUL, { paymentId: payment.id, orderId: payment.order_id, reference: paymentReference });
        eventBus.emit(AppEvents.ORDER_PAID, { orderId: payment.order_id });
      } catch (evtErr) {
        logger.error('Error emitting post-payment events:', evtErr);
      }

      return { success: true, payment: updatedPayment, order: updatedOrder };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export default PaymentWebhookWorkflow;
