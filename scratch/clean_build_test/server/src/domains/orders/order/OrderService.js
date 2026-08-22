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
  static async calculateTotals(items, feesConfig = Fees) {
    let subtotal = 0;
    const itemDetails = items.map(item => {
      const price = Number(item.price);
      const qty = Number(item.quantity || 1);
      subtotal += price * qty;
      return { ...item, lineTotal: price * qty };
    });
    const feeRate = feesConfig.PLATFORM_FEE_PERCENT || 0.05;
    const platformFee = Math.round(subtotal * feeRate * 100) / 100;
    const escrowAmount = subtotal;
    const totalAmount = subtotal + platformFee;
    return { subtotal, platformFee, escrowAmount, totalAmount, itemDetails };
  }

  static async updateOrderStatus(orderId, user, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }
      const currentOrder = orderRes.rows[0];
      assertValidTransition(currentOrder.status, status);

      const updateRes = await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
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

  static async _emitOrderUpdate(orderId, oldStatus, newStatus, notes, source) {
    try {
      eventBus.emit(AppEvents.ORDER_UPDATED, { orderId, oldStatus, newStatus, notes, source });
    } catch (err) {
      logger.error('Failed to emit order update event:', err);
    }
  }

  static async _generateOrderNumber(client = pool) {
    const res = await client.query("SELECT nextval('order_number_seq') as seq");
    const seq = res.rows[0].seq;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `BYB-ORD-${dateStr}-${String(seq).padStart(6, '0')}`;
  }
}

export default OrderService;
