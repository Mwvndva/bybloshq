import { pool } from '../../../infrastructure/database/database.js';
import logger from '../../../shared/utils/logger.js';
import Fees from '../../../shared/config/fees.js';
import { OrderStatus, ProductType, OrderType } from '../../../shared/constants/enums.js';
import Order from './order.model.js';
import Buyer from '../../commerce/buyers/buyer.model.js';
import escrowManager from '../escrow/EscrowManager.js';
import { assertValidTransition } from '../../../shared/utils/OrderStatusGuard.js';
import domainEventDispatcher, { AppEvents, DomainEvents } from '../../../shared/core/domainEventDispatcher.js';
const eventBus = domainEventDispatcher;
import InventoryReservationService from '../../commerce/products/inventoryReservation.service.js';
import OrderReadService from './orderRead.service.js';

export class OrderService {
  static async updateOrderStatus(orderId, user, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM product_orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }
      const currentOrder = orderRes.rows[0];
      assertValidTransition(currentOrder.status, status);

      const updateRes = await client.query(
        'UPDATE product_orders SET status = $1::order_status, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, orderId]
      );
      const updatedOrder = updateRes.rows[0];

      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, currentOrder.status, status, 'Status update', user.id);
      return updatedOrder;
    } catch (err) {
      await client.query('ROLLBACK').catch(rErr => logger.error('Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  // Seller confirms a (service) booking: PAID/AWAITING_SELLER_ACTION/BOOKED -> FULFILLING.
  // Restored against product_orders + the current OrderStatusGuard.
  static async confirmBooking(orderId, sellerId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 AND seller_id = $2 FOR UPDATE',
        [orderId, sellerId]
      );
      if (rows.length === 0) throw new Error('Order not found or unauthorized seller');
      const order = rows[0];
      assertValidTransition(order.status, OrderStatus.FULFILLING);
      const upd = await client.query(
        'UPDATE product_orders SET status = $1::order_status, updated_at = NOW() WHERE id = $2 RETURNING *',
        [OrderStatus.FULFILLING, orderId]
      );
      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.FULFILLING, 'Seller confirmed booking', sellerId);
      return upd.rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch((rErr) => logger.error('[confirmBooking] Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  // Buyer confirms receipt/collection: READY_FOR_BUYER/DELIVERED/FULFILLED -> COMPLETED.
  // Per the authoritative rule, the BUYER's confirmation marks completion (for both
  // delivery and collection); completion fires the payout trigger. Mzigo does not complete.
  static async _buyerComplete(orderId, buyerId, note) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE',
        [orderId, buyerId]
      );
      if (rows.length === 0) {
        const { AppError } = await import('../../../shared/utils/errorHandler.js');
        throw new AppError('Order not found or unauthorized buyer', 404, 'ORDER_NOT_FOUND');
      }
      const order = rows[0];
      assertValidTransition(order.status, OrderStatus.COMPLETED, orderId);

      const completionMetadata = {
        completed_by: 'buyer',
        completion_reason: 'buyer_confirmation',
        financial_finality: true,
        confirmed_at: new Date().toISOString()
      };

      const upd = await client.query(
        `UPDATE product_orders 
         SET status = $1::order_status, 
             completed_at = NOW(), 
             updated_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $2 
         RETURNING *`,
        [OrderStatus.COMPLETED, orderId, JSON.stringify(completionMetadata)]
      );
      const completedOrder = upd.rows[0];

      await escrowManager.releaseFunds(client, completedOrder, 'BuyerConfirmation');

      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.COMPLETED, note, buyerId);
      return completedOrder;
    } catch (err) {
      await client.query('ROLLBACK').catch((rErr) => logger.error('[buyerComplete] Rollback failed:', rErr));
      throw err;
    } finally {
      client.release();
    }
  }

  static async confirmOrderReceipt(orderId, buyerId) {
    return OrderService._buyerComplete(orderId, buyerId, 'Buyer confirmed receipt');
  }

  static async markAsCollected(orderId, buyerId) {
    return OrderService._buyerComplete(orderId, buyerId, 'Buyer collected order');
  }

  // Cancellation delegates to the (previously orphaned) OrderCancellationService,
  // which cancels on product_orders and refunds the buyer when already paid.
  // order.controller cancelOrder/sellerCancelOrder call OrderService.cancelOrder,
  // which was missing after the refactor (runtime TypeError → cancellation broken).
  static async cancelOrder(orderId, reason = null) {
    const { default: OrderCancellationService } = await import('./orderCancellation.service.js');
    return OrderCancellationService.cancelOrder(orderId, reason);
  }

  /**
   * Exceptional administrative reversal of an order (even after completion).
   * Authorized strictly for admins to handle fraud, chargebacks, legal disputes, etc.
   * Performs complete accounting reversal across Buyer, Seller, Creator, and Platform allocations.
   */
  static async executeExceptionalReversal(orderId, adminUser, reason, notes = null) {
    const { AppError } = await import('../../../shared/utils/errorHandler.js');
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new AppError(
        'A valid administrative reason (minimum 5 characters) is required for exceptional reversal.',
        400,
        'INVALID_REVERSAL_REASON'
      );
    }

    const { default: settlementService } = await import('../escrow/settlement.service.js');
    const client = await pool.connect();
    let reversedEventId = null;

    try {
      await client.query('BEGIN');

      const { rows: orderRows } = await client.query(
        'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderRows.length === 0) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }
      const order = orderRows[0];

      if (order.status === OrderStatus.REFUNDED) {
        throw new AppError('Order is already refunded', 400, 'ORDER_ALREADY_REFUNDED');
      }

      const previousStatus = order.status;
      const refundAmount = Number.parseFloat(order.total_amount || 0);

      // 1. Buyer Refund: Credit buyer refund balance if order was paid or completed
      let buyerRefundResult = null;
      if (order.payment_status === 'completed' || ['PAID', 'COMPLETED', 'FULFILLING', 'DELIVERED', 'READY_FOR_BUYER'].includes(order.status)) {
        if (order.buyer_id && refundAmount > 0) {
          await client.query(
            `UPDATE buyers 
             SET refunds = COALESCE(refunds, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [refundAmount, order.buyer_id]
          );
          buyerRefundResult = { refunded: true, amount: refundAmount, buyer_id: order.buyer_id };
        }
      }

      // 2. Seller Settlement Reversal
      const sellerReversalResult = await settlementService.reverseOrderSettlementForRefund(
        client,
        orderId,
        'admin_exceptional_reversal'
      );

      // 3. Creator Commission & Referral Reversal (with Deficit Protection)
      const creatorReversalResult = await settlementService.reverseCreatorEarningsForRefund(
        client,
        orderId,
        'admin_exceptional_reversal'
      );

      // 4. Release slots / reservations if applicable
      if (order.order_type === OrderType.SERVICE) {
        await client.query(
          `UPDATE service_slots 
           SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
           WHERE reserved_by_order_id = $1`,
          [orderId]
        );
      } else if (order.order_type === OrderType.PHYSICAL) {
        try {
          await InventoryReservationService.releaseOrderInventory(client, orderId);
        } catch (invErr) {
          logger.warn(`[ExceptionalReversal] Inventory release skipped or not needed for Order ${orderId}:`, invErr.message);
        }
      }

      // 5. Update Order Status to REFUNDED with audit metadata
      const reversalAudit = {
        exceptional_reversal: true,
        reversal_type: 'ADMIN_EXCEPTIONAL_REVERSAL',
        reversed_at: new Date().toISOString(),
        admin_id: adminUser?.id || null,
        admin_email: adminUser?.email || 'admin',
        reason: reason.trim(),
        notes: notes || null,
        previous_status: previousStatus,
        financial_summary: {
          buyer_refund: buyerRefundResult,
          seller_reversal: sellerReversalResult,
          creator_reversal: creatorReversalResult
        }
      };

      const { rows: updatedRows } = await client.query(
        `UPDATE product_orders 
         SET status = $1::order_status,
             cancelled_at = COALESCE(cancelled_at, NOW()),
             updated_at = NOW(),
             metadata = jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{exceptional_reversal}',
               $2::jsonb,
               true
             )
         WHERE id = $3
         RETURNING *`,
        [OrderStatus.REFUNDED, JSON.stringify(reversalAudit), orderId]
      );
      const updatedOrder = updatedRows[0];

      // 6. Enqueue durable domain event
      const reversedEvent = await eventBus.enqueueInTransaction(client, AppEvents.ORDER.CANCELLED, {
        eventId: `order.exceptional_reversal:${orderId}`,
        order: updatedOrder,
        cancelledBy: `admin:${adminUser?.id || 'system'}`,
        reason,
        reversalAudit
      });
      reversedEventId = reversedEvent.eventId;

      await client.query('COMMIT');

      if (reversedEventId) {
        eventBus.dispatchAfterCommit(reversedEventId, 'OrderService.executeExceptionalReversal');
      }
      OrderService._emitOrderUpdate(orderId, previousStatus, OrderStatus.REFUNDED, `Admin exceptional reversal: ${reason}`, adminUser?.id);

      logger.info(`[ExceptionalReversal] Order ${orderId} reversed by Admin ${adminUser?.id || 'admin'}. Reason: ${reason}`);

      return {
        success: true,
        order: updatedOrder,
        audit: reversalAudit
      };
    } catch (error) {
      await client.query('ROLLBACK').catch((rErr) => logger.error('[executeExceptionalReversal] Rollback failed:', rErr));
      throw error;
    } finally {
      client.release();
    }
  }

  static _parseMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }

  static _isPaidOrder(order) {
    if (!order) return false;
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    if (paymentStatus === 'completed' || paymentStatus === 'paid') return true;
    const orderStatus = String(order.status || '').toUpperCase();
    return [
      OrderStatus.PAID,
      OrderStatus.AWAITING_SELLER_ACTION,
      OrderStatus.FULFILLING,
      OrderStatus.READY_FOR_BUYER,
      OrderStatus.COMPLETED
    ].includes(orderStatus);
  }

  static _isPhysicalOnlineOrder(order) {
    if (!order) return false;
    const orderType = String(order.order_type || '').toUpperCase();
    if (orderType === OrderType.PHYSICAL) return true;
    if (orderType === OrderType.DIGITAL || orderType === OrderType.SERVICE) return false;
    const fulfillmentType = String(order.fulfillment_type || '').toUpperCase();
    if (fulfillmentType === 'PHYSICAL') return true;
    return !order.is_digital;
  }

  static _hasActivePickup(order) {
    if (!order) return false;
    const pickupStatus = String(order.pickup_leg_status || '').toLowerCase();
    if (['pending', 'active', 'assigned', 'in_transit', 'picked_up'].includes(pickupStatus)) {
      return true;
    }
    const meta = this._parseMetadata(order.metadata);
    const sellerHandoff = meta.seller_handoff || {};
    if (sellerHandoff.method === 'seller_pickup' && ['pickup_requested', 'pickup_paid', 'active'].includes(sellerHandoff.status)) {
      return true;
    }
    if (meta.seller_pickup?.payment_status === 'pending') {
      return true;
    }
    return false;
  }

  static _hasBuyerDoorDelivery(order) {
    if (!order) return false;
    const deliveryType = String(order.delivery_type || '').toUpperCase();
    if (deliveryType === 'DOOR_DELIVERY') return true;
    if (order.delivery_leg_id != null) return true;
    if (order.shipping_address != null) return true;
    const meta = this._parseMetadata(order.metadata);
    if (meta.buyer_delivery_required === true) return true;
    if (meta.pricing?.buyer_delivery_fee > 0) return true;
    return false;
  }

  static async _emitOrderUpdate(orderId, oldStatus, newStatus, notes, source) {
    try {
      eventBus.emit(AppEvents.ORDER_UPDATED, { orderId, oldStatus, newStatus, notes, source });
    } catch (err) {
      logger.error('Failed to emit order update event:', err);
    }
  }

  static async _generateOrderNumber(client = pool) {
    try {
      await client.query("CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 100001");
    } catch (e) {
      // Ignored
    }
    const res = await client.query("SELECT nextval('order_number_seq') as seq");
    const seq = res.rows[0].seq;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ORD-${dateStr}-${String(seq).padStart(6, '0')}`;
  }
}

export default OrderService;
