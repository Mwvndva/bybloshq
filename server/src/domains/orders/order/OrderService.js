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
    let subtotalCents = 0;
    const itemDetails = items.map(item => {
      const priceCents = Math.round(Number(item.price || 0) * 100);
      const qty = Number(item.quantity || 1);
      const lineTotalCents = priceCents * qty;
      subtotalCents += lineTotalCents;
      return { ...item, lineTotal: lineTotalCents / 100 };
    });
    const feeRate = feesConfig.PLATFORM_FEE_PERCENT || 0.05;
    const platformFeeCents = Math.round(subtotalCents * feeRate);
    const escrowAmountCents = subtotalCents;
    const totalAmountCents = subtotalCents + platformFeeCents;
    return {
      subtotal: subtotalCents / 100,
      platformFee: platformFeeCents / 100,
      escrowAmount: escrowAmountCents / 100,
      totalAmount: totalAmountCents / 100,
      itemDetails
    };
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
