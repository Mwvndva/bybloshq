import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../shared/constants/enums.js';
import Order from '../models/order.model.js';
import eventBus, { AppEvents } from '../events/eventBus.js';
import InventoryReservationService from './inventoryReservation.service.js';
import settlementService from './settlement.service.js';

class OrderCancellationService {
  static async cancelOrder(orderId, reason = null) {
    const client = await pool.connect();
    let cancelledEventId = null;
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderResult.rows.length === 0) throw new Error('Order not found');
      const order = orderResult.rows[0];

      if (order.status === OrderStatus.COMPLETED) throw new Error('Cannot cancel a completed order');
      if (order.status === OrderStatus.CANCELLED) throw new Error('Order is already cancelled');

      const updatedOrder = await Order.updateStatusWithReason(client, orderId, OrderStatus.CANCELLED, reason);

      if (updatedOrder) {
        if (order.payment_status === 'completed') {
          const refundAmount = Number.parseFloat(order.total_amount);
          await client.query(
            `UPDATE buyers 
             SET refunds = COALESCE(refunds, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [refundAmount, order.buyer_id]
          );
          await settlementService.reverseOrderSettlementForRefund(client, orderId, 'order_cancellation');
        }

        if (order.order_type === OrderType.SERVICE) {
          await client.query(
            `UPDATE service_slots 
             SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
             WHERE reserved_by_order_id = $1`,
            [orderId]
          );
          logger.info(`[SLOT-RELEASE] Released slot for cancelled Order ${orderId}`);
        }

        const statusForRelease = String(order.status || '').toUpperCase();
        const canReleaseInventory = ['CREATED', 'RESERVED', 'HELD', 'PAYMENT_PENDING', 'FAILED', 'EXPIRED'].includes(statusForRelease);
        if (order.order_type === OrderType.PHYSICAL && canReleaseInventory) {
          await InventoryReservationService.releaseOrderInventory(client, orderId);
        } else if (order.order_type === OrderType.PHYSICAL) {
          logger.warn(`[RESERVATION-RELEASE] Skipped inventory release for Order ${orderId} in status ${order.status}`);
        }

        const cancelledEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.CANCELLED, {
          eventId: `order.cancelled:${orderId}`,
          order: updatedOrder,
          cancelledBy: reason || 'system',
          reason
        });
        cancelledEventId = cancelledEvent.eventId;
      }

      await client.query('COMMIT');
      if (cancelledEventId) {
        eventBus.dispatchAfterCommit(cancelledEventId, 'OrderCancellationService.cancelOrder');
      }
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError =>
        logger.error('[OrderCancellationService] Rollback failed:', rollbackError)
      );
      throw error;
    } finally {
      client.release();
    }
  }
}

export default OrderCancellationService;
