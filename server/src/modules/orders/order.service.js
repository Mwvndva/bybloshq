import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from '../../models/order.model.js';
import cacheService from '../../shared/utils/cache.service.js';
import BookingService from '../bookings/booking.service.js';
import ProductModel from '../../models/product.model.js';
import { OrderStatus } from '../../shared/constants/enums.js';
import { assertValidTransition } from '../../shared/utils/OrderStatusGuard.js';

class OrderService {
    /**
     * Create a new order (Ported from legacy OrderService)
     */
    static async createOrder(orderData, externalClient = null) {
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

            const orderNumber = await this.generateOrderNumber(client);

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
                    'SELECT id, name, price, product_type, is_digital, track_inventory FROM products WHERE id = $1',
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
                    isDigital: product.is_digital,
                    track_inventory: product.track_inventory
                });
            }

            // Calculate fees using platform rates (1% commission)
            const commissionRate = 0.01;
            const platformFee = Math.round(calculatedTotal * commissionRate * 100) / 100;
            const sellerPayout = Math.round((calculatedTotal - platformFee) * 100) / 100;

            // 4. Insert Order
            const reservationTTL = 15; // 15 minutes
            const reservationExpiresAt = new Date(Date.now() + reservationTTL * 60 * 1000);

            // Entry state for all orders is now CREATED
            const initialStatus = OrderStatus.CREATED;

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
                total_quantity: enrichedItems.reduce((acc, cur) => acc + (cur.quantity || 1), 0),
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
                    } else {
                        // Use unified atomic reserve method
                        await ProductModel.reserve(client, item.productId, item.quantity);
                    }
                }
            }

            // 7. Transition to HELD or RESERVED based on type (Enforced by State Machine)
            const targetStatus = enrichedItems[0]?.productType === 'service' ? OrderStatus.HELD : OrderStatus.RESERVED;
            assertValidTransition(initialStatus, targetStatus, order.id);
            await OrderModel.updateStatusWithSideEffects(client, order.id, targetStatus, 'pending');

            if (isManaged) await client.query('COMMIT');

            logger.info(`[OrderService] Order ${order.id} created and transitioned to ${targetStatus}`);
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

    static async generateOrderNumber(client) {
        const prefix = 'BY';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}${timestamp}${random}`;
    }
}

export default OrderService;
