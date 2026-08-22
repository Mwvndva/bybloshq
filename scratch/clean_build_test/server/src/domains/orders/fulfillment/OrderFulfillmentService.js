import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import { OrderStatus } from '../../../shared/constants/enums.js';
import { assertValidTransition } from '../../../shared/utils/OrderStatusGuard.js';
import domainEventDispatcher, { AppEvents, DomainEvents } from '../../../shared/core/domainEventDispatcher.js';
const eventBus = domainEventDispatcher;

export class OrderFulfillmentService {
  static async confirmBooking(orderId, sellerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 AND seller_id = $2 FOR UPDATE', [orderId, sellerId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found or unauthorized seller');
      }
      const order = orderRes.rows[0];
      assertValidTransition(order.status, OrderStatus.CONFIRMED);

      const updateRes = await client.query(
        "UPDATE orders SET status = $1, confirmed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *",
        [OrderStatus.CONFIRMED, orderId]
      );
      await client.query('COMMIT');
      eventBus.emit(AppEvents.ORDER_UPDATED, { orderId, oldStatus: order.status, newStatus: OrderStatus.CONFIRMED });
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  static async markAsCollected(orderId, buyerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE', [orderId, buyerId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found or unauthorized buyer');
      }
      const order = orderRes.rows[0];
      assertValidTransition(order.status, OrderStatus.DELIVERED);

      const updateRes = await client.query(
        "UPDATE orders SET status = $1, collected_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *",
        [OrderStatus.DELIVERED, orderId]
      );
      await client.query('COMMIT');
      eventBus.emit(AppEvents.ORDER_UPDATED, { orderId, oldStatus: order.status, newStatus: OrderStatus.DELIVERED });
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  static async confirmOrderReceipt(orderId, buyerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE', [orderId, buyerId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found or unauthorized buyer');
      }
      const order = orderRes.rows[0];
      assertValidTransition(order.status, OrderStatus.COMPLETED);

      const updateRes = await client.query(
        "UPDATE orders SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *",
        [OrderStatus.COMPLETED, orderId]
      );
      await client.query('COMMIT');
      eventBus.emit(AppEvents.ORDER_UPDATED, { orderId, oldStatus: order.status, newStatus: OrderStatus.COMPLETED });
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export default OrderFulfillmentService;
