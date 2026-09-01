import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import { OrderStatus, OrderType } from '../../../shared/constants/enums.js';
import Order from './order.model.js';
import domainEventDispatcher, { AppEvents, DomainEvents } from '../../../shared/core/domainEventDispatcher.js';
const eventBus = domainEventDispatcher;
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import settlementService from '../escrow/settlement.service.js';

import { AppError } from '../../../shared/utils/errorHandler.js';

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

      if (orderResult.rows.length === 0) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }
      const order = orderResult.rows[0];

      // Invariant: Once COMPLETED, normal user-facing cancellation/refund is prohibited.
      if (order.status === OrderStatus.COMPLETED) {
        throw new AppError(
          'This order has already been confirmed and is no longer eligible for a normal refund.',
          400,
          'ORDER_FINANCIALLY_FINAL'
        );
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new AppError('Order is already cancelled', 400, 'ORDER_ALREADY_CANCELLED');
      }
      if (order.status === OrderStatus.REFUNDED) {
        throw new AppError('Order is already refunded', 400, 'ORDER_ALREADY_REFUNDED');
      }

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
