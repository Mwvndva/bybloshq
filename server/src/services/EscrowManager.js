import { pool } from '../shared/db/database.js';
import logger from '../shared/utils/logger.js';
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

        // 1. DB-LEVEL IDEMPOTENCY CHECK: Ensure payouts table is the source of truth.
        // We check if a payout already exists for this order before proceeding.
        // Using FOR UPDATE on the payouts table (if record exists) to serialize concurrent releases.
        const { rows: existingPayouts } = await client.query(
            'SELECT id, status FROM payouts WHERE order_id = $1 FOR UPDATE',
            [orderId]
        );

        if (existingPayouts.length > 0) {
            logger.info(`[EscrowManager] Payout for Order ${orderId} already exists (Status: ${existingPayouts[0].status}). Skipping.`);
            return { success: true, alreadyReleased: true };
        }

        // 2. Fetch or resolve payment ID
        const paymentResult = await client.query(
            "SELECT id FROM payments WHERE invoice_id = $1 OR metadata->>'order_id' = $2::text LIMIT 1",
            [order.order_number, String(orderId)]
        );
        const paymentId = paymentResult.rows[0]?.id;

        // 3. Calculate amounts safely
        const rawPayout = Number.parseFloat(
            order.seller_payout_amount ?? order.sellerPayoutAmount ?? 0
        );
        const rawTotal = Number.parseFloat(
            order.total_amount ?? order.totalAmount ?? 0
        );

        // Guard: if either value is NaN or 0, abort — something is wrong upstream
        if (isNaN(rawPayout) || rawPayout <= 0) {
            logger.error(
                `[EscrowManager] Invalid seller_payout_amount for Order ${orderId}: ` +
                `"${order.seller_payout_amount ?? order.sellerPayoutAmount}". Aborting release.`
            );
            return { success: false, reason: 'invalid_payout_amount' };
        }
        if (isNaN(rawTotal) || rawTotal <= 0) {
            logger.error(
                `[EscrowManager] Invalid total_amount for Order ${orderId}: ` +
                `"${order.total_amount ?? order.totalAmount}". Aborting release.`
            );
            return { success: false, reason: 'invalid_total_amount' };
        }

        const sellerPayoutAmount = Math.round(rawPayout * 100) / 100;
        const totalAmount = Math.round(rawTotal * 100) / 100;
        const platformFeeAmount = Math.round(
            Number.parseFloat(
                order.platform_fee_amount ?? order.platformFeeAmount ?? (totalAmount - sellerPayoutAmount)
            ) * 100
        ) / 100;
        const sellerId = order.seller_id ?? order.sellerId;

        if (sellerPayoutAmount <= 0) {
            logger.warn(`[EscrowManager] Non-positive payout (${sellerPayoutAmount}) for Order ${orderId}. Skipping wallet credit.`);
            return { success: true };
        }

        // 4. Update Seller Wallet
        await client.query(
            `UPDATE sellers
             SET balance     = balance     + $1,
                 net_revenue = net_revenue + $1,
                 total_sales = total_sales + $2,
                 updated_at  = NOW()
             WHERE id = $3`,
            [sellerPayoutAmount, totalAmount, sellerId],
        );

        // 5. Create Payout Record (Source of truth for "processed")
        // We use ON CONFLICT as a safety net, but the primary check (step 1) should catch most cases.
        await client.query(
            `INSERT INTO payouts
               (seller_id, order_id, payment_id, amount, platform_fee, status,
                payment_method, processed_at, completed_at, metadata)
             VALUES ($1, $2, $3, $4, $5, 'completed', 'wallet_credit', NOW(), NOW(), $6)
             ON CONFLICT (order_id) DO UPDATE
               SET status       = 'completed',
                   processed_at = NOW(),
                   completed_at = NOW(),
                   payment_id   = EXCLUDED.payment_id,
                   amount       = EXCLUDED.amount,
                   platform_fee = EXCLUDED.platform_fee,
                   metadata     = jsonb_set(
                     COALESCE(payouts.metadata, '{}'::jsonb),
                     '{processed_by}',
                     $6::jsonb
                   )`,
            [sellerId, orderId, paymentId, sellerPayoutAmount, platformFeeAmount, JSON.stringify({ processed_by: source })],
        );

        // 6. Optional: Update order metadata for visibility, but NOT as the source of truth for logic
        await client.query(
            `UPDATE product_orders 
             SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{payout_processed}', 'true'::jsonb),
                 updated_at = NOW()
             WHERE id = $1`,
            [orderId]
        );

        logger.info(
            `[EscrowManager] Released KES ${sellerPayoutAmount} to seller ${sellerId} for Order ${orderId} (source: ${source})`,
        );
        return { success: true, alreadyReleased: false };
    }
}

export default new EscrowManager();


