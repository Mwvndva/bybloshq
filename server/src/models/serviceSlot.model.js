import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

class ServiceSlot {
    /**
     * Reserve a service slot atomically.
     */
    static async reserve(client, { productId, timeSlot, orderId }) {
        const executor = client || pool;
        const result = await executor.query(
            `INSERT INTO service_slots (service_id, time_slot, status, reserved_by_order_id, expires_at)
             VALUES ($1, $2, 'RESERVED', $3, NOW() + INTERVAL '15 minutes')
             ON CONFLICT (service_id, time_slot) DO UPDATE
               SET 
                 status = 'RESERVED',
                 reserved_by_order_id = $3,
                 expires_at = NOW() + INTERVAL '15 minutes',
                 updated_at = NOW()
               WHERE 
                 service_slots.status = 'AVAILABLE' 
                 OR (service_slots.status = 'RESERVED' AND service_slots.expires_at < NOW())
             RETURNING id, status`,
            [productId, timeSlot, orderId]
        );
        return result.rows[0];
    }

    /**
     * Get slot details.
     */
    static async findByServiceSlot(client, serviceId, timeSlot) {
        const executor = client || pool;
        const { rows } = await executor.query(
            `SELECT status, expires_at, reserved_by_order_id FROM service_slots 
             WHERE service_id = $1 AND time_slot = $2`,
            [serviceId, timeSlot]
        );
        return rows[0];
    }

    /**
     * Transition slot to BOOKED.
     */
    static async finalize(client, orderId) {
        const executor = client || pool;
        const { rows } = await executor.query(
            `UPDATE service_slots 
             SET 
               status = 'BOOKED',
               updated_at = NOW()
             WHERE reserved_by_order_id = $1 AND status = 'RESERVED'
             RETURNING id`,
            [orderId]
        );
        return rows;
    }

    static async releaseByOrderId(client, orderId) {
        const query = `
      UPDATE service_slots 
      SET status = 'AVAILABLE',
          reserved_by_order_id = NULL,
          expires_at = NULL,
          updated_at = NOW()
      WHERE reserved_by_order_id = $1
    `;
        const executor = client || pool;
        await executor.query(query, [orderId]);
    }
}

export default ServiceSlot;
