import { pool } from '../../shared/db/database.js';
import logger from '../../shared/utils/logger.js';
import OrderModel from '../orders/order.model.js';

class BookingService {
    /**
     * Hold a slot during order creation (CRITICAL FIX: SLOT-LOCKING)
     */
    static async reserveSlot(client, slotId, orderId) {
        const holdDurationMinutes = 15;
        const result = await client.query(
            `UPDATE service_slots 
             SET status = 'HELD', 
                 reserved_by_order_id = $1, 
                 expires_at = NOW() + INTERVAL '${holdDurationMinutes} minutes',
                 updated_at = NOW()
             WHERE id = $2 AND (status = 'AVAILABLE' OR (status = 'HELD' AND expires_at < NOW()))
             RETURNING *`,
            [orderId, slotId]
        );

        if (result.rows.length === 0) {
            throw new Error('Service slot is no longer available or already held by another user.');
        }

        logger.info(`[Booking] Slot ${slotId} held for Order ${orderId} (Expires in ${holdDurationMinutes}m)`);
        return result.rows[0];
    }

    /**
     * Finalize a service booking after payment
     */
    static async confirmBooking(order) {
        logger.info(`[Booking] Confirming booking for Order ${order.id}`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `UPDATE service_slots 
                 SET status = 'BOOKED', expires_at = NULL, updated_at = NOW()
                 WHERE reserved_by_order_id = $1 AND (status = 'HELD' OR status = 'AVAILABLE')
                 RETURNING *`,
                [order.id]
            );

            if (result.rows.length === 0) {
                logger.error(`[Booking] FAILED to confirm: Slot lost or expired for Order ${order.id}`);
                throw new Error('Service slot reservation expired before payment confirmation.');
            }

            await OrderModel.updateStatus(client, order.id, 'SERVICE_PENDING');

            await client.query('COMMIT');
            logger.info(`[Booking] Successfully confirmed booking for Order ${order.id}`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`[Booking] Failed to confirm booking for Order ${order.id}:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Release a reservation (e.g. on cancellation or timeout)
     */
    static async releaseReservation(orderId) {
        const query = `
      UPDATE service_slots 
      SET status = 'AVAILABLE', reserved_by_order_id = NULL, expires_at = NULL, updated_at = NOW()
      WHERE reserved_by_order_id = $1
    `;
        await pool.query(query, [orderId]);
        logger.info(`[Booking] Released reservation for Order ${orderId}`);
    }
}

export default BookingService;
