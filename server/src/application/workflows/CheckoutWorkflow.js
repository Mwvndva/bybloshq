import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import Fees from '../../shared/config/fees.js';
import { OrderStatus } from '../../shared/constants/enums.js';
import escrowManager from '../../domains/orders/escrow/EscrowManager.js';
import InventoryReservationService from '../../domains/commerce/products/inventoryReservation.service.js';
import OrderService from '../../domains/orders/order/OrderService.js';
import eventBus, { AppEvents } from '../events/eventBus.js';

export class CheckoutWorkflow {
  static async createOrder(orderData, externalClient = null) {
    const isManaged = !externalClient;
    const client = externalClient || (await pool.connect());

    try {
      if (isManaged) await client.query('BEGIN');

      const { buyerId, sellerId, items, shippingAddress, referralCode } = orderData;

      // 1. Calculate Totals
      const { subtotal, platformFee, escrowAmount, totalAmount } = await OrderService.calculateTotals(items, Fees);

      // 2. Reserve Stock (Synchronous inside SQL Tx)
      if (items && items.length > 0) {
        await InventoryReservationService.reserveStock(client, items);
      }

      // 3. Generate Order Number & Insert Order
      const orderNumber = await OrderService._generateOrderNumber(client);
      const orderRes = await client.query(
        `INSERT INTO orders 
          (order_number, buyer_id, seller_id, status, subtotal_amount, platform_fee_amount, escrow_amount, total_amount, shipping_address, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [orderNumber, buyerId, sellerId, OrderStatus.PENDING, subtotal, platformFee, escrowAmount, totalAmount, JSON.stringify(shippingAddress)]
      );
      const order = orderRes.rows[0];

      // 4. Create Escrow Lock (Synchronous inside SQL Tx)
      await escrowManager.createEscrow(client, order.id, escrowAmount);

      if (isManaged) await client.query('COMMIT');

      // 5. Post-Commit Async Event Emission
      try {
        eventBus.emit(AppEvents.ORDER_CREATED, { orderId: order.id, buyerId, sellerId, totalAmount });
        if (referralCode) {
          eventBus.emit(AppEvents.SALE_ATTRIBUTED, { orderId: order.id, buyerId, referralCode, amount: totalAmount });
        }
      } catch (evtErr) {
        logger.error('Error emitting post-checkout events:', evtErr);
      }

      return order;
    } catch (err) {
      if (isManaged) {
        await client.query('ROLLBACK').catch(rErr => logger.error('Rollback failed:', rErr));
      }
      throw err;
    } finally {
      if (isManaged) client.release();
    }
  }
}

export default CheckoutWorkflow;
