import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from './order.model.js';
import cacheService from '../../shared/utils/cache.service.js';
import BookingService from '../bookings/booking.service.js';
import { assertValidTransition } from '../../shared/utils/OrderStatusGuard.js';
import { AppError } from '../../shared/utils/errorHandler.js';

class OrderService {
    /**
     * Create a new order (Ported from legacy OrderService)
     */
    static async createOrder(orderData, externalClient = null) {
        const isManaged = !externalClient;
        const client = externalClient || await pool.connect();

        const lockKey = `lock:buyer:${orderData.buyer?.id || orderData.buyer?.email}`;
        if (cacheService?.redis) {
            const acquired = await cacheService.redis.set(lockKey, 'locked', 'EX', 30, 'NX');
            if (!acquired) throw new AppError('An order is already being processed for this user. Please wait.', 429);
        }

        try {
            if (isManaged) await client.query('BEGIN');

            const items = orderData.items || [];
            const enrichedItems = items.map(item => ({
                ...item,
                subtotal: item.price * item.quantity,
                productType: item.productType || 'physical'
            }));

            const calculatedTotal = enrichedItems.reduce((acc, item) => acc + item.subtotal, 0);
            const commissionRate = 0.05; // 5% platform fee
            const platformFee = Math.round(calculatedTotal * commissionRate * 100) / 100;
            const sellerPayout = Math.round((calculatedTotal - platformFee) * 100) / 100;

            const orderNumber = await this.generateOrderNumber(client);
            const reservationTTL = 15; // 15 minutes
            const reservationExpiresAt = new Date(Date.now() + reservationTTL * 60 * 1000);

            const initialStatus = enrichedItems[0]?.productType === 'service' ? 'HELD' : 'RESERVED';

            const buyer = orderData.buyer || {};

            const orderRecord = {
                order_number: orderNumber,
                buyer_id: buyer.id,
                seller_id: orderData.sellerId,
                total_amount: calculatedTotal,
                platform_fee_amount: platformFee,
                seller_payout_amount: sellerPayout,
                payment_method: orderData.payment?.method || 'payd',
                buyer_name: buyer.name,
                buyer_email: buyer.email,
                buyer_mobile_payment: buyer.phone,
                buyer_whatsapp_number: buyer.phone,
                status: initialStatus,
                payment_status: 'pending',
                order_type: enrichedItems[0]?.isDigital ? 'DIGITAL' : (enrichedItems[0]?.productType === 'service' ? 'SERVICE' : 'PHYSICAL'),
                total_quantity: enrichedItems.reduce((acc, item) => acc + item.quantity, 0),
                reservation_expires_at: reservationExpiresAt,
                metadata: {
                    items: enrichedItems,
                    source: 'web_checkout',
                    product_type: enrichedItems[0]?.productType || 'physical'
                }
            };

            const savedOrder = await OrderModel.insert(client, orderRecord);
            await OrderModel.insertItems(client, savedOrder.id, enrichedItems);

            for (const item of enrichedItems) {
                if (item.productType === 'service' && item.slotId) {
                    await BookingService.reserveSlot(client, item.slotId, savedOrder.id);
                } else {
                    await client.query(
                        `UPDATE products 
                         SET quantity = quantity - $1, 
                             reserved_quantity = reserved_quantity + $1,
                             updated_at = NOW() 
                         WHERE id = $2 AND track_inventory = TRUE`,
                        [item.quantity, item.productId]
                    );
                }
            }

            if (isManaged) await client.query('COMMIT');
            return savedOrder;
        } catch (error) {
            if (isManaged) await client.query('ROLLBACK');
            logger.error('[OrderService] Error creating order:', error);
            throw error;
        } finally {
            if (isManaged) client.release();
            if (cacheService?.redis) {
                await cacheService.redis.del(lockKey).catch(() => { });
            }
        }
    }

    /**
     * Transition an order to a new state with strict validation and side effects
     */
    static async transitionTo(orderId, targetStatus, metadata = {}, externalClient = null) {
        const isManaged = !externalClient;
        const client = externalClient || await pool.connect();

        try {
            if (isManaged) await client.query('BEGIN');

            const { rows: orderRows } = await client.query(
                'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
                [orderId]
            );
            const order = orderRows[0];

            if (!order) {
                throw new AppError(`Order ${orderId} not found`, 404);
            }

            const currentStatus = order.status;
            assertValidTransition(currentStatus, targetStatus, order.order_number);

            if (currentStatus === targetStatus) {
                if (isManaged) await client.query('COMMIT');
                return order;
            }

            logger.info(`[STATE-MACHINE] Transitioning Order ${order.order_number} from ${currentStatus} -> ${targetStatus}`);

            await this.handleStateSideEffects(client, order, targetStatus, metadata);
            const updatedOrder = await OrderModel.updateStatus(client, orderId, targetStatus);

            if (isManaged) await client.query('COMMIT');
            return updatedOrder;
        } catch (error) {
            if (isManaged) await client.query('ROLLBACK');
            logger.error(`[STATE-MACHINE] Transition failed for Order ${orderId}:`, error);
            throw error;
        } finally {
            if (isManaged) client.release();
        }
    }

    static async handleStateSideEffects(client, order, targetStatus, metadata) {
        switch (targetStatus) {
            case 'PAID':
                await this.handlePaidAction(client, order);
                break;
            case 'CANCELLED':
                await this.handleCancelledAction(client, order);
                break;
            case 'FULFILLED':
                await this.handleFulfilledAction(client, order);
                break;
            case 'EXPIRED':
                await this.handleCancelledAction(client, order);
                break;
        }
    }

    static async handlePaidAction(client, order) {
        if (order.order_type === 'DIGITAL') {
            await this.transitionTo(order.id, 'FULFILLED', {}, client);
        } else if (order.order_type === 'SERVICE') {
            await this.transitionTo(order.id, 'BOOKED', {}, client);
        } else {
            await this.transitionTo(order.id, 'FULFILLMENT_PENDING', {}, client);
        }
    }

    static async handleCancelledAction(client, order) {
        const { rows: items } = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);

        for (const item of items) {
            if (order.order_type === 'SERVICE' && item.metadata?.slotId) {
                await BookingService.releaseReservation(order.id);
            } else {
                await client.query(
                    `UPDATE products 
                     SET quantity = quantity + $1, 
                         reserved_quantity = GREATEST(0, reserved_quantity - $1),
                         updated_at = NOW() 
                     WHERE id = $2 AND track_inventory = TRUE`,
                    [item.quantity, item.product_id]
                );
            }
        }

        if (order.buyer_id && order.total_amount > 0) {
            logger.info(`[REFUND] Crediting KES ${order.total_amount} back to buyer ${order.buyer_id} for order ${order.order_number}`);
            await client.query(
                `UPDATE buyers SET refunds = refunds + $1, updated_at = NOW() WHERE id = $2`,
                [order.total_amount, order.buyer_id]
            );
        }
    }

    static async handleFulfilledAction(client, order) {
        const { rows: items } = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);

        for (const item of items) {
            if (order.order_type !== 'SERVICE') {
                await client.query(
                    `UPDATE products 
                     SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
                         updated_at = NOW() 
                     WHERE id = $2 AND track_inventory = TRUE`,
                    [item.quantity, item.product_id]
                );
            }
        }

        if (order.order_type === 'DIGITAL') {
            await this.grantDigitalAccess(client, order);
        }
    }

    static async grantDigitalAccess(client, order) {
        logger.info(`[DIGITAL-DELIVERY] Granting access for Order ${order.order_number}`);
    }

    static async generateOrderNumber(client) {
        const prefix = 'BY';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}${timestamp}${random}`;
    }
}

export default OrderService;
