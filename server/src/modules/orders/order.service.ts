import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from './order.model.js';
import cacheService from '../../shared/utils/cache.service.js';
import BookingService from '../bookings/booking.service.js';
import { assertValidTransition } from '../../shared/utils/OrderStatusGuard.js';
import { OrderStatus } from './order.types.js';
import { AppError } from '../../shared/utils/errorHandler.js';

class OrderService {
    /**
     * Create a new order (Ported from legacy OrderService)
     */
    static async createOrder(orderData: any, externalClient: any = null) {
        const {
            buyer,
            service,
            location,
            metadata = {},
            idempotencyKey = null
        } = orderData;

        const lockKey = idempotencyKey ? `lock:order_create:${idempotencyKey}` : `lock:order_create:buyer:${buyer.id}:seller:${orderData.sellerId}`;

        const isManaged = !externalClient;
        const client = externalClient || await pool.connect();

        try {
            // 1. Acquire Lock (Simple Redis Lock)
            if (cacheService?.redis) {
                const acquired = await cacheService.redis.set(lockKey, 'locked', 'EX', 10, 'NX');
                if (!acquired) {
                    throw new Error('Order creation already in progress. Please wait.');
                }
            }

            if (isManaged) await client.query('BEGIN');

            // 2. Resolve and verify prices from DB (CRITICAL FIX: PRICE-VERIFICATION)
            const items = metadata.items || [];
            if (items.length === 0 && service) {
                // Handle legacy single-item format
                items.push({
                    productId: Number.parseInt(service.id, 10),
                    quantity: Number.parseInt(service.quantity, 10) || 1
                });
            }

            let calculatedTotal = 0;
            const enrichedItems = [];

            for (const item of items) {
                const productRes = await client.query(
                    'SELECT id, name, price, product_type, is_digital FROM products WHERE id = $1',
                    [item.productId]
                );
                const product = productRes.rows[0];

                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found`);
                }

                const itemPrice = Number.parseFloat(product.price);
                const itemQty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
                const itemSubtotal = Math.round(itemPrice * itemQty * 100) / 100;

                calculatedTotal += itemSubtotal;
                enrichedItems.push({
                    ...item,
                    name: product.name,
                    price: itemPrice,
                    subtotal: itemSubtotal,
                    productType: product.product_type,
                    isDigital: product.is_digital
                });
            }

            // Calculate fees using platform rates (1% commission)
            const commissionRate = 0.01;
            const platformFee = Math.round(calculatedTotal * commissionRate * 100) / 100;
            const sellerPayout = Math.round((calculatedTotal - platformFee) * 100) / 100;

            // 4. Insert Order
            const orderNumber = await this.generateOrderNumber(client);
            const reservationTTL = 15; // 15 minutes
            const reservationExpiresAt = new Date(Date.now() + reservationTTL * 60 * 1000);

            const initialStatus = enrichedItems[0]?.productType === 'service' ? 'HELD' : 'RESERVED';

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
                location_address: location?.address || null,
                location_lat: location?.lat || null,
                location_lng: location?.lng || null,
                service_title: enrichedItems[0]?.name || 'Product',
                metadata: { ...metadata, items: enrichedItems },
                status: initialStatus,
                payment_status: 'pending',
                order_type: orderData.orderType || (enrichedItems[0]?.productType === 'service' ? 'SERVICE' : (enrichedItems[0]?.isDigital ? 'DIGITAL' : 'PHYSICAL')),
                fulfillment_type: orderData.fulfillmentType || null,
                total_quantity: enrichedItems.reduce((acc: number, cur: any) => acc + (cur.quantity || 1), 0),
                reservation_expires_at: reservationExpiresAt
            };

            const order = await OrderModel.insert(client, orderRecord);

            // 5. Insert Items
            if (enrichedItems.length > 0) {
                await OrderModel.insertItems(client, order.id, enrichedItems);

                // 6. Reserve Inventory/Slots (CRITICAL FIX: ATOMIC-RESERVATION)
                for (const item of enrichedItems) {
                    if (item.productType === 'service' && item.slotId) {
                        await BookingService.reserveSlot(client, item.slotId, order.id);
                    } else if (item.productType !== 'service') {
                        // Atomic inventory decrement AND reservation increment for all products (Physical/Digital)
                        const invResult = await client.query(
                            `UPDATE products 
                             SET quantity = quantity - $1, 
                                 reserved_quantity = reserved_quantity + $1,
                                 updated_at = NOW() 
                             WHERE id = $2 AND track_inventory = TRUE AND quantity >= $1`,
                            [item.quantity, item.productId]
                        );
                        if (invResult.rowCount === 0) {
                            // Check if it's because tracking is off or stock is low
                            const check = await client.query('SELECT track_inventory, quantity FROM products WHERE id = $1', [item.productId]);
                            if (check.rows[0]?.track_inventory && check.rows[0]?.quantity < item.quantity) {
                                throw new Error(`Insufficient stock for product: ${item.name}`);
                            }
                        }
                    }
                }
            }

            if (isManaged) await client.query('COMMIT');

            logger.info(`[OrderService] Order ${order.id} created with verified amount KES ${calculatedTotal}`);
            return order;
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
    static async transitionTo(orderId: number, targetStatus: OrderStatus, metadata: any = {}, externalClient: any = null) {
        const isManaged = !externalClient;
        const client = externalClient || await pool.connect();

        try {
            if (isManaged) await client.query('BEGIN');

            // 1. Lock Order for Update
            const { rows: orderRows } = await client.query(
                'SELECT * FROM product_orders WHERE id = $1 FOR UPDATE',
                [orderId]
            );
            const order = orderRows[0];

            if (!order) {
                throw new AppError(`Order ${orderId} not found`, 404);
            }

            const currentStatus = order.status;

            // 2. Validate Transition
            assertValidTransition(currentStatus, targetStatus, order.order_number);

            if (currentStatus === targetStatus) {
                if (isManaged) await client.query('COMMIT');
                return order;
            }

            logger.info(`[STATE-MACHINE] Transitioning Order ${order.order_number} from ${currentStatus} -> ${targetStatus}`);

            // 3. Status-Specific Side Effects
            await this.handleStateSideEffects(client, order, targetStatus, metadata);

            // 4. Update Status
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

    /**
     * Handle logic triggered by specific state transitions
     */
    private static async handleStateSideEffects(client: any, order: any, targetStatus: OrderStatus, metadata: any) {
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
                await this.handleCancelledAction(client, order); // Same as cancelled for inventory/bookings
                break;
        }
    }

    private static async handlePaidAction(client: any, order: any) {
        // Logic for paid orders: trigger fulfillment queue or digital access
        if (order.order_type === 'DIGITAL') {
            // Auto-fulfill digital items
            await this.transitionTo(order.id, 'FULFILLED', {}, client);
        } else if (order.order_type === 'SERVICE') {
            await this.transitionTo(order.id, 'BOOKED', {}, client);
        } else {
            await this.transitionTo(order.id, 'FULFILLMENT_PENDING', {}, client);
        }
    }

    private static async handleCancelledAction(client: any, order: any) {
        // 1. Release inventory / slots
        const { rows: items } = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);

        for (const item of items) {
            if (order.order_type === 'SERVICE' && item.metadata?.slotId) {
                await BookingService.releaseReservation(order.id);
            } else {
                // Revert inventory
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

        // 2. Refund buyer (if payment was at least attempted or order was paid)
        if (order.buyer_id && order.total_amount > 0) {
            logger.info(`[REFUND] Crediting KES ${order.total_amount} back to buyer ${order.buyer_id} for order ${order.order_number}`);
            await client.query(
                `UPDATE buyers SET refunds = refunds + $1, updated_at = NOW() WHERE id = $2`,
                [order.total_amount, order.buyer_id]
            );
        }
    }

    private static async handleFulfilledAction(client: any, order: any) {
        // Finalize inventory (remove from reserved)
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

    private static async grantDigitalAccess(client: any, order: any) {
        // Implementation for digital delivery
        logger.info(`[DIGITAL-DELIVERY] Granting access for Order ${order.order_number}`);
        // TODO: Insert into digital_access table
    }

    private static async generateOrderNumber(client: any) {
        const prefix = 'BY';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}${timestamp}${random}`;
    }
}

export default OrderService;
