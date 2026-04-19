import logger from '../utils/logger.js';
import Payout from '../models/payout.model.js';
import Payment from '../models/payment.model.js';
import Seller from '../models/seller.model.js';
import Order from '../models/order.model.js';

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
        const existingPayouts = await Payout.findByOrderIdForUpdate(client, orderId);

        if (existingPayouts.length > 0) {
            logger.info(`[EscrowManager] Payout for Order ${orderId} already exists (Status: ${existingPayouts[0].status}). Skipping.`);
            return { success: true, alreadyReleased: true };
        }

        // 2. Fetch or resolve payment ID
        const payment = await Payment.findByOrderReference(client, order.order_number, orderId);
        const paymentId = payment?.id;

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
        await Seller.creditEscrowRelease(client, sellerId, sellerPayoutAmount, totalAmount);

        // 5. Create Payout Record (Source of truth for "processed")
        // We use ON CONFLICT as a safety net, but the primary check (step 1) should catch most cases.
        await Payout.createPayout(client, {
            seller_id: sellerId,
            order_id: orderId,
            payment_id: paymentId,
            amount: sellerPayoutAmount,
            platform_fee: platformFeeAmount,
            status: 'completed',
            payment_method: 'wallet_credit',
            metadata: { processed_by: source }
        });

        // 6. Optional: Update order metadata for visibility, but NOT as the source of truth for logic
        await Order.markPayoutProcessed(client, orderId);

        logger.info(
            `[EscrowManager] Released KES ${sellerPayoutAmount} to seller ${sellerId} for Order ${orderId} (source: ${source})`,
        );
        return { success: true, alreadyReleased: false };
    }
}

export default new EscrowManager();
