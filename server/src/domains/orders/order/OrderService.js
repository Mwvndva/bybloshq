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
        'UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
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
        'UPDATE product_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
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
      if (rows.length === 0) throw new Error('Order not found or unauthorized buyer');
      const order = rows[0];
      assertValidTransition(order.status, OrderStatus.COMPLETED);
      const upd = await client.query(
        'UPDATE product_orders SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
        [OrderStatus.COMPLETED, orderId]
      );
      await client.query('COMMIT');
      OrderService._emitOrderUpdate(orderId, order.status, OrderStatus.COMPLETED, note, buyerId);
      return upd.rows[0];
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
