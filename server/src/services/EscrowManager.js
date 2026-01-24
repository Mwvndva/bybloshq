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
        try {
            // 1. Lock and Check Order Metadata
            const orderCheck = await client.query(
                'SELECT metadata FROM product_orders WHERE id = $1 FOR UPDATE',
                [order.id]
            );
            const currentMeta = orderCheck.rows[0]?.metadata || {};

            if (currentMeta.payout_processed) {
                logger.info(`[EscrowManager] Funds for Order ${order.id} already released. Skipping.`);
                return { success: true, alreadyReleased: true };
            }

            // 2. Extract/Calculate Amounts
            const sellerPayoutAmount = parseFloat(order.seller_payout_amount || 0);
            const totalAmount = parseFloat(order.total_amount || 0);
            const platformFeeAmount = parseFloat(order.platform_fee_amount || (totalAmount - sellerPayoutAmount));

            if (sellerPayoutAmount <= 0) {
                logger.warn(`[EscrowManager] Non-positive payout amount for Order ${order.id}: ${sellerPayoutAmount}`);
            }

            // 3. Update Seller Balance and Revenue
            // Atomic increment of balance, net_revenue, and total_sales
            await client.query(
                `UPDATE sellers 
         SET 
           balance = balance + $1,
           net_revenue = net_revenue + $1,
           total_sales = total_sales + $2,
           updated_at = NOW()
         WHERE id = $3`,
                [sellerPayoutAmount, totalAmount, order.seller_id]
            );

            // 4. Handle Payout Record
            // Check if a payout record already exists (usually created by DB trigger handle_order_completion)
            const payoutResult = await client.query(
                'SELECT id FROM payouts WHERE order_id = $1',
                [order.id]
            );

            if (payoutResult.rows.length > 0) {
                // Update existing payout record
                await client.query(
                    `UPDATE payouts 
           SET status = 'completed', 
               processed_at = NOW(),
               completed_at = NOW(),
               amount = $2,
               platform_fee = $3,
               metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb), 
                 '{processed_by}', 
                 $4::jsonb
               )
           WHERE order_id = $1`,
                    [order.id, sellerPayoutAmount, platformFeeAmount, JSON.stringify(source)]
                );
            } else {
                // Create new payout record if it doesn't exist
                await client.query(
                    `INSERT INTO payouts (
            seller_id, order_id, amount, platform_fee, status, 
            payment_method, processed_at, completed_at, metadata
          ) VALUES ($1, $2, $3, $4, 'completed', 'wallet_credit', NOW(), NOW(), $5)`,
                    [
                        order.seller_id,
                        order.id,
                        sellerPayoutAmount,
                        platformFeeAmount,
                        JSON.stringify({ processed_by: source, auto_created: true })
                    ]
                );
            }

            // 5. Mark Order as Payout Processed
            await client.query(
                `UPDATE product_orders 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb),
             updated_at = NOW()
         WHERE id = $1`,
                [order.id]
            );

            logger.info(`[EscrowManager] Successfully released KES ${sellerPayoutAmount} to Seller ${order.seller_id} for Order ${order.id} (Source: ${source})`);

            return { success: true };
        } catch (error) {
            logger.error(`[EscrowManager] Error releasing funds for Order ${order.id}:`, error);
            throw error;
        }
    }
}

export default new EscrowManager();
