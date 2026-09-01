import logger from '../../../shared/utils/logger.js';

const DEFAULT_SETTLEMENT_BUSINESS_DAYS = 2;

function isWeekend(date) {
    const day = date.getUTCDay();
    return day === 0 || day === 6;
}

export function addBusinessDays(startDate, days) {
    const result = new Date(startDate);
    let remaining = Math.max(0, Number.parseInt(days, 10) || 0);

    while (remaining > 0) {
        result.setUTCDate(result.getUTCDate() + 1);
        if (!isWeekend(result)) {
            remaining -= 1;
        }
    }

    return result;
}

class SettlementService {
    getSettlementBusinessDays(env = process.env) {
        const configured = Number.parseInt(env.PAYSTACK_SETTLEMENT_BUSINESS_DAYS, 10);
        return Number.isFinite(configured) && configured >= 0
            ? configured
            : DEFAULT_SETTLEMENT_BUSINESS_DAYS;
    }

    calculateAvailableAt(fromDate = new Date(), env = process.env) {
        return addBusinessDays(fromDate, this.getSettlementBusinessDays(env));
    }

    parseMetadata(value) {
        if (!value) return {};
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        }
        return value;
    }

    getWithdrawalTotal(request) {
        const metadata = this.parseMetadata(request?.metadata);
        const withdrawalFee = Number.parseFloat(metadata.withdrawal_fee || 0);
        const amount = Number.parseFloat(request?.amount || 0);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        const safeFee = Number.isFinite(withdrawalFee) ? withdrawalFee : 0;
        return safeAmount + safeFee;
    }

    async promoteEligibleSettlements(client, { limit = 100 } = {}) {
        const { rows: payouts } = await client.query(
            `SELECT id, seller_id, amount
             FROM payouts
             WHERE settlement_status = 'pending_settlement'
               AND available_at <= NOW()
               AND seller_id IS NOT NULL
             ORDER BY available_at ASC, id ASC
             LIMIT $1
             FOR UPDATE SKIP LOCKED`,
            [limit]
        );

        let promoted = 0;
        for (const payout of payouts) {
            const amount = Number.parseFloat(payout.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) {
                await client.query(
                    `UPDATE payouts
                     SET settlement_status = 'settlement_review',
                         settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1
                       AND settlement_status = 'pending_settlement'`,
                    [payout.id, JSON.stringify({ reason: 'invalid_settlement_amount' })]
                );
                continue;
            }

            const { rowCount } = await client.query(
                `UPDATE sellers
                 SET pending_settlement_balance = GREATEST(COALESCE(pending_settlement_balance, 0) - $1, 0),
                     balance = COALESCE(balance, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [amount, payout.seller_id]
            );

            if (rowCount === 0) {
                await client.query(
                    `UPDATE payouts
                     SET settlement_status = 'settlement_review',
                         settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1
                       AND settlement_status = 'pending_settlement'`,
                    [payout.id, JSON.stringify({ reason: 'seller_missing_at_settlement' })]
                );
                continue;
            }

            await client.query(
                `UPDATE payouts
                 SET status = 'completed',
                     settlement_status = 'settled',
                     settled_at = NOW(),
                     completed_at = COALESCE(completed_at, NOW()),
                     settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1
                   AND settlement_status = 'pending_settlement'`,
                [payout.id, JSON.stringify({ promoted_by: 'settlement_service' })]
            );
            promoted += 1;
        }

        if (promoted > 0) {
            logger.info(`[SettlementService] Promoted ${promoted} payout(s) to available seller balance`);
        }

        return { scanned: payouts.length, promoted };
    }

    async reverseOrderSettlementForRefund(client, orderId, source = 'refund') {
        const { rows: payouts } = await client.query(
            `SELECT id, seller_id, amount, settlement_status, status
             FROM payouts
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId]
        );

        const payout = payouts[0];
        if (!payout || !payout.seller_id) {
            return { adjusted: false, reason: 'no_seller_payout' };
        }

        const amount = Number.parseFloat(payout.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            return { adjusted: false, reason: 'invalid_payout_amount' };
        }

        const settlementStatus = String(payout.settlement_status || '').toLowerCase();
        if (settlementStatus === 'pending_settlement') {
            await client.query(
                `UPDATE sellers
                 SET pending_settlement_balance = GREATEST(COALESCE(pending_settlement_balance, 0) - $1, 0),
                     refund_reserved_balance = COALESCE(refund_reserved_balance, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [amount, payout.seller_id]
            );
            await client.query(
                `UPDATE payouts
                 SET status = 'refunded',
                     settlement_status = 'refunded_before_settlement',
                     settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [payout.id, JSON.stringify({ refund_source: source, refunded_at: new Date().toISOString() })]
            );
            return { adjusted: true, bucket: 'pending_settlement', amount };
        }

        if (settlementStatus === 'settled') {
            const { rows: reservedRows } = await client.query(
                `UPDATE sellers
                 SET balance = balance - $1,
                     refund_reserved_balance = COALESCE(refund_reserved_balance, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2
                   AND balance >= $1
                 RETURNING balance`,
                [amount, payout.seller_id]
            );

            if (reservedRows.length === 0) {
                await client.query(
                    `UPDATE payouts
                     SET settlement_status = 'refund_compensation_required',
                         settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [payout.id, JSON.stringify({
                        refund_source: source,
                        reason: 'seller_available_balance_insufficient',
                        manual_compensation_required: true
                    })]
                );
                return { adjusted: false, reason: 'manual_compensation_required' };
            }

            await client.query(
                `UPDATE payouts
                 SET status = 'refunded',
                     settlement_status = 'refunded_after_settlement',
                     settlement_metadata = COALESCE(settlement_metadata, '{}'::jsonb) || $2::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [payout.id, JSON.stringify({ refund_source: source, refunded_at: new Date().toISOString() })]
            );
            return { adjusted: true, bucket: 'available_balance', amount };
        }

        return { adjusted: false, reason: `settlement_status_${settlementStatus || 'unknown'}` };
    }

    async reverseCreatorEarningsForRefund(client, orderId, source = 'refund') {
        const results = {
            salesCommission: null,
            referralCommission: null
        };

        // 1. Reversal for creator sales earnings
        const { rows: earningsRows } = await client.query(
            `SELECT id, creator_id, amount, status
             FROM creator_earnings
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (earningsRows.length > 0) {
            const earning = earningsRows[0];
            const amount = Number.parseFloat(earning.amount || 0);

            if (amount > 0 && earning.status !== 'reversed') {
                const { rows: creatorRows } = await client.query(
                    `SELECT id, balance FROM creators WHERE id = $1 FOR UPDATE`,
                    [earning.creator_id]
                );

                if (creatorRows.length > 0) {
                    const currentBalance = Number.parseFloat(creatorRows[0].balance || 0);

                    if (currentBalance >= amount) {
                        await client.query(
                            `UPDATE creators
                             SET balance = balance - $1,
                                 total_earnings = GREATEST(total_earnings - $1, 0),
                                 updated_at = NOW()
                             WHERE id = $2`,
                            [amount, earning.creator_id]
                        );

                        await client.query(
                            `UPDATE creator_earnings
                             SET status = 'reversed',
                                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                             WHERE id = $1`,
                            [earning.id, JSON.stringify({ reversal_source: source, reversed_at: new Date().toISOString() })]
                        );
                        results.salesCommission = { adjusted: true, amount, creator_id: earning.creator_id };
                    } else {
                        // Creator balance is insufficient (already withdrawn) - record deficit without going negative
                        await client.query(
                            `UPDATE creator_earnings
                             SET status = 'reversal_compensation_required',
                                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                             WHERE id = $1`,
                            [
                                earning.id,
                                JSON.stringify({
                                    reversal_source: source,
                                    deficit: true,
                                    shortfall: amount - currentBalance,
                                    available_balance: currentBalance,
                                    reason: 'creator_balance_insufficient',
                                    manual_compensation_required: true,
                                    flagged_at: new Date().toISOString()
                                })
                            ]
                        );
                        results.salesCommission = {
                            adjusted: false,
                            reason: 'creator_balance_insufficient',
                            deficit: amount - currentBalance,
                            creator_id: earning.creator_id
                        };
                    }
                }
            }
        }

        // 2. Reversal for creator-refers-seller earnings
        const { rows: refEarningsRows } = await client.query(
            `SELECT id, referrer_creator_id, amount, status
             FROM creator_referral_earnings
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId]
        );

        if (refEarningsRows.length > 0) {
            const refEarning = refEarningsRows[0];
            const refAmount = Number.parseFloat(refEarning.amount || 0);

            if (refAmount > 0 && refEarning.status !== 'reversed') {
                const { rows: refCreatorRows } = await client.query(
                    `SELECT id, balance FROM creators WHERE id = $1 FOR UPDATE`,
                    [refEarning.referrer_creator_id]
                );

                if (refCreatorRows.length > 0) {
                    const currentRefBalance = Number.parseFloat(refCreatorRows[0].balance || 0);

                    if (currentRefBalance >= refAmount) {
                        await client.query(
                            `UPDATE creators
                             SET balance = balance - $1,
                                 total_referral_earnings = GREATEST(total_referral_earnings - $1, 0),
                                 updated_at = NOW()
                             WHERE id = $2`,
                            [refAmount, refEarning.referrer_creator_id]
                        );

                        await client.query(
                            `UPDATE creator_referral_earnings
                             SET status = 'reversed',
                                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                             WHERE id = $1`,
                            [refEarning.id, JSON.stringify({ reversal_source: source, reversed_at: new Date().toISOString() })]
                        );
                        results.referralCommission = { adjusted: true, amount: refAmount, referrer_creator_id: refEarning.referrer_creator_id };
                    } else {
                        await client.query(
                            `UPDATE creator_referral_earnings
                             SET status = 'reversal_compensation_required',
                                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
                             WHERE id = $1`,
                            [
                                refEarning.id,
                                JSON.stringify({
                                    reversal_source: source,
                                    deficit: true,
                                    shortfall: refAmount - currentRefBalance,
                                    available_balance: currentRefBalance,
                                    reason: 'creator_referral_balance_insufficient',
                                    manual_compensation_required: true,
                                    flagged_at: new Date().toISOString()
                                })
                            ]
                        );
                        results.referralCommission = {
                            adjusted: false,
                            reason: 'creator_referral_balance_insufficient',
                            deficit: refAmount - currentRefBalance,
                            referrer_creator_id: refEarning.referrer_creator_id
                        };
                    }
                }
            }
        }

        return results;
    }
}

export default new SettlementService();
