import cron from 'node-cron';
import { pool } from '../../infrastructure/database/database.js';
import logger from '../../shared/utils/logger.js';
import InventoryReservationService from '../../domains/commerce/products/inventoryReservation.service.js';

/**
 * Auto-release inventory for unpaid abandoned orders (payment_status='pending')
 * older than 15 minutes, cancelling each one.
 *
 * The cancel UPDATE is guarded by `payment_status = 'pending'` and inventory is
 * released ONLY when that UPDATE actually cancelled the order (rowCount > 0). This
 * makes the job:
 *  - race-safe: a payment that completes between the SELECT and the UPDATE is not
 *    cancelled (its payment_status is no longer 'pending'), so a paid order can
 *    never be wrongly failed and stripped of inventory; and
 *  - idempotent under multi-instance: two workers cannot both cancel/release the
 *    same order — the loser's guarded UPDATE matches zero rows and is skipped.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} [client]
 * @returns {Promise<{ scanned: number, cancelled: number }>}
 */
export async function releaseExpiredUnpaidReservations(client = pool) {
    const { rows: expiredOrders } = await client.query(
        `SELECT id FROM product_orders
         WHERE payment_status = 'pending'
           AND created_at < NOW() - INTERVAL '15 minutes'`
    );

    let cancelled = 0;
    for (const order of expiredOrders) {
        try {
            const { rowCount } = await client.query(
                // Canonical order status is the UPPERCASE order_status vocabulary
                // ('CANCELLED'); payment_status uses the lowercase set ('failed').
                `UPDATE product_orders
                 SET status = 'CANCELLED', payment_status = 'failed', updated_at = NOW()
                 WHERE id = $1 AND payment_status = 'pending'`,
                [order.id]
            );
            // Order was paid (or handled by another worker) between SELECT and now — skip.
            if (rowCount === 0) continue;

            await InventoryReservationService.releaseOrderInventory(client, order.id);
            cancelled += 1;
            logger.info(`[INVENTORY_TTL] Auto-released inventory for unpaid abandoned order ${order.id}`);
        } catch (err) {
            logger.error(`[INVENTORY_TTL] Failed releasing order ${order.id}:`, err.message);
        }
    }

    return { scanned: expiredOrders.length, cancelled };
}

/** Delete pending_registrations whose verification window has expired. */
export async function deleteExpiredPendingRegistrations() {
    const result = await pool.query(
        `DELETE FROM pending_registrations WHERE expires_at < NOW()`
    );
    logger.info(`[CLEANUP] Deleted ${result.rowCount} expired pending registrations`);
    return result.rowCount;
}

export const scheduleCleanupJobs = () => {
    // Every 5 minutes: release expired unpaid inventory reservations.
    cron.schedule('*/5 * * * *', async () => {
        const client = await pool.connect();
        try {
            await releaseExpiredUnpaidReservations(client);
        } catch (err) {
            logger.error('[INVENTORY_TTL_CRON] Error running inventory release cron:', err.message);
        } finally {
            client.release();
        }
    });

    // Daily at 3am Nairobi time: purge expired pending registrations.
    cron.schedule('0 3 * * *', async () => {
        try {
            await deleteExpiredPendingRegistrations();
        } catch (err) {
            logger.error('[CLEANUP] Failed to clean pending_registrations:', err.message);
        }
    }, { timezone: 'Africa/Nairobi' });
};
