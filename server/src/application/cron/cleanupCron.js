import cron from 'node-cron';
import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import InventoryReservationService from '../../domains/commerce/products/inventoryReservation.service.js';

export const scheduleCleanupJobs = () => {
    // Run every 5 minutes to release expired unpaid inventory reservations
    cron.schedule('*/5 * * * *', async () => {
        const client = await pool.connect();
        try {
            // Auto-release abandoned unpaid orders older than 15 minutes (900 seconds)
            const { rows: expiredOrders } = await client.query(
                `SELECT id FROM product_orders 
                 WHERE payment_status = 'pending' 
                   AND created_at < NOW() - INTERVAL '15 minutes'`
            );
            for (const order of expiredOrders) {
                try {
                    await InventoryReservationService.releaseOrderInventory(client, order.id);
                    await client.query(
                        `UPDATE product_orders SET status = 'cancelled', payment_status = 'failed' WHERE id = $1`,
                        [order.id]
                    );
                    logger.info(`[INVENTORY_TTL] Auto-released inventory for unpaid abandoned order ${order.id}`);
                } catch (err) {
                    logger.error(`[INVENTORY_TTL] Failed releasing order ${order.id}:`, err.message);
                }
            }
        } catch (err) {
            logger.error('[INVENTORY_TTL_CRON] Error running inventory release cron:', err.message);
        } finally {
            client.release();
        }
    });

    // Run daily at 3am Nairobi time
    cron.schedule('0 3 * * *', async () => {
        try {
            const result = await pool.query(
                `DELETE FROM pending_registrations WHERE expires_at < NOW()`
            );
            logger.info(`[CLEANUP] Deleted ${result.rowCount} expired pending registrations`);
        } catch (err) {
            logger.error('[CLEANUP] Failed to clean pending_registrations:', err.message);
        }
    }, { timezone: 'Africa/Nairobi' });
};


