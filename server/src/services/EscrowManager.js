import logger from '../shared/utils/logger.js';
import CreatorService from './creator.service.js';

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
        const orderStatus = String(order.status || '').toUpperCase();

        if (orderStatus !== 'COMPLETED') {
            logger.warn(`[EscrowManager] Escrow release blocked for Order ${orderId}; order status is ${orderStatus || 'unknown'}.`);
            return { success: false, reason: 'order_not_completed' };
        }

        // 1. Fetch or resolve payment ID
        const paymentResult = await client.query(
            "SELECT id FROM payments WHERE invoice_id = $1 OR metadata->>'order_id' = $2::text LIMIT 1",
            [order.order_number, String(orderId)]
        );
        const paymentId = paymentResult.rows[0]?.id;

        const { rows: logisticsHolds } = await client.query(
            `SELECT lr.status AS request_status,
                    BOOL_OR(ll.status = 'failed') AS has_failed_leg
             FROM logistics_requests lr
             LEFT JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
             WHERE lr.order_id = $1
               AND lr.status <> 'cancelled'
             GROUP BY lr.id, lr.status
             LIMIT 1`,
            [orderId]
        );

        const logisticsHold = logisticsHolds[0];
        if (
            logisticsHold
            && (
                logisticsHold.request_status === 'manual_review'
                || logisticsHold.request_status === 'failed'
                || logisticsHold.has_failed_leg === true
            )
        ) {
            logger.warn(`[EscrowManager] Escrow release blocked for Order ${orderId}; logistics requires review.`);
            return { success: false, reason: 'logistics_delivery_hold' };
        }

        // 2. Calculate amounts safely
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
        const platformFeeAmount = this.calculatePlatformRetainedAmount(order, totalAmount, sellerPayoutAmount);
        const sellerId = order.seller_id ?? order.sellerId;

        if (!sellerId) {
            logger.error(`[EscrowManager] Missing seller_id for Order ${orderId}. Aborting escrow release.`);
            return { success: false, reason: 'missing_seller_id' };
        }

        if (sellerPayoutAmount <= 0) {
            logger.warn(`[EscrowManager] Non-positive payout (${sellerPayoutAmount}) for Order ${orderId}. Skipping wallet credit.`);
            return { success: true };
        }

        // 3. Create payout row first. This is the idempotency gate.
        // If another transaction already inserted this order_id, do not credit the wallet.
        const { rows: insertedPayouts } = await client.query(
            `INSERT INTO payouts
               (seller_id, order_id, payment_id, amount, platform_fee, status,
                payment_method, processed_at, completed_at, metadata)
             VALUES ($1, $2, $3, $4, $5, 'completed', 'wallet_credit', NOW(), NOW(), $6)
             ON CONFLICT (order_id) DO NOTHING
             RETURNING id`,
            [sellerId, orderId, paymentId, sellerPayoutAmount, platformFeeAmount, JSON.stringify({ processed_by: source })],
        );

        if (insertedPayouts.length === 0) {
            logger.info(`[EscrowManager] Payout for Order ${orderId} already exists. Skipping wallet credit.`);
            return { success: true, alreadyReleased: true };
        }

        // 4. Update Seller Wallet exactly once after the payout idempotency gate wins.
        const { rows: updatedSellers } = await client.query(
            `UPDATE sellers
             SET balance     = COALESCE(balance, 0)     + $1,
                 net_revenue = COALESCE(net_revenue, 0) + $1,
                 total_sales = COALESCE(total_sales, 0) + $2,
                 updated_at  = NOW()
             WHERE id = $3
             RETURNING balance, net_revenue, total_sales`,
            [sellerPayoutAmount, totalAmount, sellerId],
        );

        if (updatedSellers.length === 0) {
            logger.error(`[EscrowManager] Seller ${sellerId} not found while releasing escrow for Order ${orderId}. Rolling back payout.`);
            throw new Error(`Seller ${sellerId} not found for escrow release`);
        }

        await CreatorService.creditCreatorForOrder(client, { order, paymentId });
        await CreatorService.creditCreatorReferralForSeller(client, { order });

        // 5. Optional: Update order metadata for visibility, but NOT as the source of truth for logic
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

    roundMoney(amount) {
        return Math.round(Number(amount || 0) * 100) / 100;
    }

    getOrderMetadata(order) {
        if (!order?.metadata) return {};
        if (typeof order.metadata === 'string') {
            try {
                return JSON.parse(order.metadata);
            } catch {
                return {};
            }
        }
        return order.metadata;
    }

    calculatePlatformRetainedAmount(order, totalAmount, sellerPayoutAmount) {
        const metadata = this.getOrderMetadata(order);
        const hasCheckoutPricing = Boolean(
            metadata?.pricing?.payable_total !== undefined
            || metadata?.pricing?.buyer_delivery_fee !== undefined
            || metadata?.pricing?.buyer_service_charge !== undefined
        );

        if (hasCheckoutPricing) {
            const buyerDeliveryFee = this.roundMoney(metadata?.pricing?.buyer_delivery_fee || 0);
            const retainedAmount = this.roundMoney(totalAmount - sellerPayoutAmount - buyerDeliveryFee);

            if (Number.isFinite(retainedAmount) && retainedAmount >= 0) {
                return retainedAmount;
            }
        }

        return this.roundMoney(
            Number.parseFloat(
                order.platform_fee_amount ?? order.platformFeeAmount ?? (totalAmount - sellerPayoutAmount)
            )
        );
    }
}

export default new EscrowManager();


