import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';

class EscrowManager {
    /**
     * Release funds from escrow to a seller's wallet.
     * This handles balance updates, revenue tracking, and payout record completion.
     * 
     * @param {Object} client - DB client for transaction support
     * @param {Object} order - The order object
     * @param {string} source - The service or component triggering the release
     */
    async releaseFunds(client, order, source = 'System') {
        const orderId = order.id;

        // Atomic test-and-set — rowCount 0 means another concurrent call already ran
        const markResult = await client.query(
            `UPDATE product_orders
         SET metadata   = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb),
             updated_at = NOW()
         WHERE id = $1
           AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'payout_processed')
         RETURNING id`,
            [orderId],
        );

        if (markResult.rowCount === 0) {
            logger.info(`[EscrowManager] Funds for Order ${orderId} already released. Skipping.`);
            return { success: true, alreadyReleased: true };
        }

        const sellerPayoutAmount = parseFloat(order.seller_payout_amount ?? order.sellerPayoutAmount ?? 0);
        const totalAmount = parseFloat(order.total_amount ?? order.totalAmount ?? 0);
        const platformFeeAmount = parseFloat(
            order.platform_fee_amount ?? order.platformFeeAmount ?? (totalAmount - sellerPayoutAmount),
        );
        const sellerId = order.seller_id ?? order.sellerId;

        if (sellerPayoutAmount <= 0) {
            logger.warn(`[EscrowManager] Non-positive payout (${sellerPayoutAmount}) for Order ${orderId}.`);
            return { success: true };
        }

        await client.query(
            `UPDATE sellers
         SET balance     = balance     + $1,
             net_revenue = net_revenue + $1,
             total_sales = total_sales + $2,
             updated_at  = NOW()
         WHERE id = $3`,
            [sellerPayoutAmount, totalAmount, sellerId],
        );

        await client.query(
            `INSERT INTO payouts
           (seller_id, order_id, amount, platform_fee, status,
            payment_method, processed_at, completed_at, metadata)
         VALUES ($1, $2, $3, $4, 'completed', 'wallet_credit', NOW(), NOW(), $5)
         ON CONFLICT (order_id) DO UPDATE
           SET status       = 'completed',
               processed_at = NOW(),
               completed_at = NOW(),
               amount       = EXCLUDED.amount,
               platform_fee = EXCLUDED.platform_fee,
               metadata     = jsonb_set(
                 COALESCE(payouts.metadata, '{}'::jsonb),
                 '{processed_by}',
                 $5::jsonb
               )`,
            [sellerId, orderId, sellerPayoutAmount, platformFeeAmount, JSON.stringify({ processed_by: source })],
        );

        logger.info(
            `[EscrowManager] Released KES ${sellerPayoutAmount} to seller ${sellerId} for Order ${orderId} (source: ${source})`,
        );
        return { success: true };
    }
}

export default new EscrowManager();
