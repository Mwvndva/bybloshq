import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';

class BookingService {
    /**
     * Reserve a time slot for a service order
     */
    static async reserveSlot(client, slotId, orderId) {
        const executor = client || pool;

        logger.info(`[BookingService] Reserved slot ${slotId} for order ${orderId}`);

        const query = `
            UPDATE service_slots
            SET status = 'RESERVED',
                reserved_by_order_id = $1,
                expires_at = NOW() + INTERVAL '15 minutes',
                updated_at = NOW()
            WHERE id = $2 AND status = 'AVAILABLE'
            RETURNING *
        `;

        const result = await executor.query(query, [orderId, slotId]);

        if (result.rowCount === 0) {
            throw new Error(`Slot ${slotId} is no longer available.`);
        }

        return result.rows[0];
    }

    /**
     * Finalize a reserved slot (mark as BOOKED)
     */
    static async finalizeSlot(client, orderId) {
        const executor = client || pool;

        logger.info(`[BookingService] Finalizing slot for order ${orderId}`);

        const query = `
            UPDATE service_slots
            SET status = 'BOOKED',
                expires_at = NULL,
                updated_at = NOW()
            WHERE reserved_by_order_id = $1
            RETURNING *
        `;

        const result = await executor.query(query, [orderId]);

        if (result.rowCount === 0) {
            logger.warn(`[BookingService] No reserved slot found for Order ${orderId} during finalization.`);
        }

        return result.rows;
    }

    /**
     * Release a reserved slot (cancel reservation)
     */
    static async releaseSlot(client, orderId) {
        const executor = client || pool;

        logger.info(`[BookingService] Releasing slot for order ${orderId}`);

        const query = `
            UPDATE service_slots
            SET status = 'AVAILABLE',
                reserved_by_order_id = NULL,
                expires_at = NULL,
                updated_at = NOW()
            WHERE reserved_by_order_id = $1
        `;

        await executor.query(query, [orderId]);
    }
}

export default BookingService;
