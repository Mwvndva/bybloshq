import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import { OrderStatus } from '../../shared/constants/enums.js';
import { assertValidTransition } from '../../shared/utils/OrderStatusGuard.js';
import InventoryReservationService from '../../domains/commerce/products/inventoryReservation.service.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

export class OrderCancellationWorkflow {
  static async cancelOrder(orderId, reason = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }
      const order = orderRes.rows[0];
      assertValidTransition(order.status, OrderStatus.CANCELLED);

      // Release stock reservations
      await InventoryReservationService.releaseReservation(client, orderId);

      const updateRes = await client.query(
        'UPDATE orders SET status = $1, cancellation_reason = $2, cancelled_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *',
        [OrderStatus.CANCELLED, reason, orderId]
      );
      await client.query('COMMIT');
      eventBus.emit(AppEvents.ORDER_CANCELLED, { orderId, oldStatus: order.status, reason });
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export default OrderCancellationWorkflow;
