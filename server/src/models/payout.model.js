import { pool } from '../config/database.js';
import { toJsonb } from '../utils/order.utils.js';

class Payout {
  /**
   * Create a payout record (Rule 10).
   */
  static async createPayout(client, data) {
    const query = `
      INSERT INTO payouts (
        seller_id, order_id, payment_id, amount, platform_fee, status,
        payment_method, processed_at, completed_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (order_id) DO UPDATE
        SET status = EXCLUDED.status,
            processed_at = EXCLUDED.processed_at,
            completed_at = EXCLUDED.completed_at,
            payment_id = EXCLUDED.payment_id,
            amount = EXCLUDED.amount,
            platform_fee = EXCLUDED.platform_fee,
            metadata = COALESCE(payouts.metadata, '{}'::jsonb) || EXCLUDED.metadata
      RETURNING *
    `;

    const values = [
      data.seller_id,
      data.order_id,
      data.payment_id,
      data.amount,
      data.platform_fee,
      data.status || 'completed',
      data.payment_method || 'wallet_credit',
      data.processed_at || new Date(),
      data.completed_at || new Date(),
      toJsonb(data.metadata || {})
    ];

    const executor = client || pool;
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  static async findByOrderId(orderId) {
    const query = 'SELECT * FROM payouts WHERE order_id = $1';
    const { rows } = await pool.query(query, [orderId]);
    return rows[0];
  }

  static async findByOrderIdForUpdate(client, orderId) {
    const query = 'SELECT id, status FROM payouts WHERE order_id = $1 FOR UPDATE';
    const executor = client || pool;
    const { rows } = await executor.query(query, [orderId]);
    return rows;
  }

  static async deleteBySellerId(client, sellerId) {
    const query = 'DELETE FROM payouts WHERE seller_id = $1';
    const executor = client || pool;
    await executor.query(query, [sellerId]);
  }
}

export default Payout;
