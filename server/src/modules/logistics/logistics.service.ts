import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from '../orders/order.model.js';

class LogisticsService {
    /**
     * Handle physical order fulfillment
     */
    static async handleDelivery(order: any) {
        logger.info(`[Logistics] Handling delivery for Order ${order.id}`);

        // 1. Determine if it's a Pickup or Courier delivery
        const fulfillmentType = order.fulfillment_type;

        if (fulfillmentType === 'BUYER_TO_SELLER') {
            // Shop Pickup
            await OrderModel.updateStatus(null, order.id, 'COLLECTION_PENDING');
            logger.info(`[Logistics] Order ${order.id} set to COLLECTION_PENDING (Shop Pickup)`);
        } else {
            // Courier or Seller to Buyer
            await OrderModel.updateStatus(null, order.id, 'DELIVERY_PENDING');
            logger.info(`[Logistics] Order ${order.id} set to DELIVERY_PENDING`);
        }

        // 2. Cleanup Reserved Quantity (CRITICAL FIX: LIFECYCLE-COMPLETION)
        // Since quantity was already decremented at reservation time, we only need to clear the reservation hold.
        const items = order.metadata?.items || [];
        for (const item of items) {
            if (item.productType !== 'service' && item.productId) {
                await pool.query(
                    'UPDATE products SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2',
                    [item.quantity || 1, item.productId]
                );
            }
        }

        logger.info(`[Logistics] Inventory reservation released for Order ${order.id}`);

        // TODO: Trigger WhatsApp notifications for logistics
    }
}

export default LogisticsService;
