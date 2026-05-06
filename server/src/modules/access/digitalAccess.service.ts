import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from '../orders/order.model.js';

class DigitalAccessService {
    /**
     * Grant access to digital products after payment
     */
    static async grantAccess(order: any) {
        logger.info(`[Digital] Granting access for Order ${order.id}`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Grant access in user_digital_access table
            // Fetch items first
            const { rows: items } = await client.query('SELECT product_id FROM order_items WHERE order_id = $1', [order.id]);

            for (const item of items) {
                await client.query(
                    `INSERT INTO user_digital_access (user_id, product_id, order_id)
           VALUES ($1, $2, $3)
           ON CONFLICT ON CONSTRAINT unique_user_product_access DO NOTHING`,
                    [order.buyer_id, item.product_id, order.id]
                );
            }

            // 2. Update Order status
            await OrderModel.updateStatus(client, order.id, 'COMPLETED');

            // 3. Cleanup Reserved Quantity (CRITICAL FIX: LIFECYCLE-COMPLETION)
            const metadataItems = order.metadata?.items || [];
            for (const item of metadataItems) {
                if (item.productType !== 'service' && item.productId) {
                    await client.query(
                        'UPDATE products SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2',
                        [item.quantity || 1, item.productId]
                    );
                }
            }

            await client.query('COMMIT');
            logger.info(`[Digital] Successfully granted access for Order ${order.id}`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`[Digital] Failed to grant access for Order ${order.id}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }
}

export default DigitalAccessService;
