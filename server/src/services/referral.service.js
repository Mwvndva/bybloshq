// @ts-nocheck
'use strict';

import crypto from 'node:crypto';

// @ts-ignore
import { pool } from '../config/database.js';
import Fees from '../config/fees.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errorHandler.js';
import Seller from '../models/seller.model.js';
import Order from '../models/order.model.js';
import ReferralEarningsLog from '../models/referralEarningsLog.model.js';

/**
 * ReferralService — all referral business logic.
 * Never import this from within a DB transaction that must be atomic with the referral op.
 */
class ReferralService {
    // ─── Code Generation ────────────────────────────────────────────────────────

    /**
     * Generate & persist a unique BY+6-char alphanumeric referral code.
     * @param {number} sellerId
     * @returns {Promise<string>} the generated code
     */
    static async generateReferralCode(sellerId) {
        // BUG 1: Enforce sales lock
        const seller = await Seller.findById(sellerId);

        if (!seller) {
            throw new AppError('Seller not found', 404);
        }

        const totalSales = Number.parseFloat(seller.total_sales || 0);

        if (totalSales <= 0) {
            // Fallback: check if there's at least one paid order (even if not yet in total_sales/escrow release)
            const orders = await Order.findBySellerId(sellerId, { limit: 1, status: 'completed' });

            if (orders.data.length === 0) {
                throw new AppError('Complete your first sale to unlock referrals', 403);
            }
        }

        const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        let code;
        let attempts = 0;
        const MAX_ATTEMPTS = 10;

        while (attempts < MAX_ATTEMPTS) {
            let suffix = '';
            for (let i = 0; i < 6; i++) {
                // Use crypto.randomInt for secure randomness (SonarQube compliance)
                suffix += CHARS.charAt(crypto.randomInt(0, CHARS.length));
            }
            code = `BY${suffix}`;

            // Check uniqueness before saving
            const existing = await Seller.findByReferralCode(code);
            if (!existing) break; // unique!
            attempts++;
        }

        if (!code) throw new AppError('Failed to generate unique referral code', 500);

        await Seller.updateReferralCode(sellerId, code);

        logger.info(`[REFERRAL] Generated referral code ${code} for seller ${sellerId}`);
        return code;
    }

    // ─── Link Generation ────────────────────────────────────────────────────────

    /**
     * Build the shareable referral URL.
     * @param {string} referralCode
     * @returns {string}
     */
    static getReferralLink(referralCode) {
        const base = process.env.FRONTEND_URL || 'https://byblos.co.ke';
        return `${base}/join?ref=${referralCode}`;
    }

    // ─── Registration Hook ──────────────────────────────────────────────────────

    /**
     * Called during seller registration when a ?ref=CODE is present.
     * Links the new seller to the referrer. Does NOT set referral_active_until.
     * @param {number} newSellerId
     * @param {string} referralCode
     */
    static async applyReferral(newSellerId, referralCode) {
        let referrer;
        try {
            referrer = await Seller.findByReferralCode(referralCode);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`[ReferralService] Error looking up referral code: ${errorMsg}`);
            return null;
        }

        if (!referrer) {
            logger.warn(`[ReferralService] Invalid referral code used: ${referralCode}`);
            return null;
        }

        const referrerId = referrer.id;

        // Guard: prevent self-referral
        if (referrerId === newSellerId) {
            logger.warn(`[REFERRAL] Seller ${newSellerId} tried to use their own referral code`);
            return;
        }

        await Seller.setReferrer(newSellerId, referrerId);

        logger.info(`[REFERRAL] Seller ${newSellerId} referred by seller ${referrerId} (code: ${referralCode})`);
    }

    // ─── First-Sale Activation Hook ─────────────────────────────────────────────

    /**
     * Called after a referred seller completes their FIRST paid order.
     * Sets referral_active_until = NOW() + 6 months.
     * @param {number} referredSellerId
     */
    static async activateReferral(referredSellerId) {
        const result = await Seller.activateReferral(referredSellerId);

        if (result) {
            logger.info(`[REFERRAL] Activated referral for seller ${referredSellerId} — expires ${result.referral_active_until}`);
            return result;
        }
        return null;
    }

    // ─── Dashboard Data ─────────────────────────────────────────────────────────

    /**
     * Returns the full referral dashboard payload for a referrer seller.
     * @param {number} referrerSellerId
     */
    static async getReferralDashboard(referrerSellerId) {
        // 1. Fetch referrer's own code and total earnings
        const referrer = await Seller.findById(referrerSellerId);

        if (!referrer) {
            throw new AppError('Seller not found', 404);
        }

        const referral_code = referrer.referral_code;
        const total_referral_earnings = referrer.total_referral_earnings;
        const referralLink = referral_code ? ReferralService.getReferralLink(referral_code) : null;

        // 2. Fetch referred sellers with aggregated earnings
        const squad = await ReferralEarningsLog.findByReferrerId(referrerSellerId);

        const now = new Date();
        const referred = squad.map(/** @param {any} row */(row) => ({
            id: row.id,
            shopName: row.shop_name,
            referralActiveUntil: row.referral_active_until,
            isActive: row.referral_active_until ? new Date(row.referral_active_until) > now : false,
            totalEarned: Number.parseFloat(row.total_earned)
        }));

        return {
            referralCode: referral_code,
            referralLink,
            totalReferralEarnings: Number.parseFloat(total_referral_earnings || 0),
            referred
        };
    }

    // ─── Monthly Payout Processing ──────────────────────────────────────────────

    /**
     * Core payout logic — called by the monthly cron.
     * Idempotent: ON CONFLICT DO NOTHING on referral_earnings_log.
     * @param {number} year
     * @param {number} month  (1-based, e.g. 3 for March)
     * @returns {Promise<{processed: number, totalCredited: number}>}
     */
    static async processMonthlyReferralRewards(year, month) {
        logger.info(`[REFERRAL-CRON] Processing referral rewards for ${year}-${String(month).padStart(2, '0')}`);

        // Fetch all active referral relationships
        const activeReferrals = await Seller.findActiveReferrals();

        if (activeReferrals.length === 0) {
            logger.info('[REFERRAL-CRON] No active referrals found — nothing to process');
            return { processed: 0, totalCredited: 0 };
        }

        logger.info(`[REFERRAL-CRON] Found ${activeReferrals.length} active referrals to process`);

        let processed = 0;
        let totalCredited = 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const row of activeReferrals) {
                const { referred_seller_id, referred_shop_name, referrer_seller_id } = row;

                // 1. Calculate Seller Payout GMV for the referred seller in the target month/year (Timezone aware)
                const gmv = await Order.calculateGmv(client, referred_seller_id, month, year);

                logger.info(`[REFERRAL-CRON] Seller ${referred_seller_id} GMV (Seller Payout) for ${year}-${month}: ${gmv}`);
                if (gmv <= 0) continue;

                // 2. Calculate reward
                const reward = Number.parseFloat((gmv * Fees.REFERRAL_REWARD_RATE).toFixed(2));

                // 3. Skip sub-1 KES rewards
                if (reward < 1) {
                    logger.info(`[REFERRAL-CRON] Skipping seller ${referred_seller_id} — reward ${reward} KES below minimum`);
                    continue;
                }

                // 4. Insert log row (idempotent)
                const logEntry = await ReferralEarningsLog.insert(client, {
                    referrer_seller_id,
                    referred_seller_id,
                    period_month: month,
                    period_year: year,
                    referred_gmv: gmv,
                    reward_amount: reward
                });

                if (!logEntry) {
                    logger.info(`[REFERRAL-CRON] Already processed referrer ${referrer_seller_id} / referred ${referred_seller_id} for ${year}-${month} — skipping`);
                    continue;
                }

                // 5. Credit referrer's balance
                await Seller.adjustReferralEarnings(client, referrer_seller_id, reward);

                processed++;
                totalCredited = Number.parseFloat((totalCredited + reward).toFixed(2));

                logger.info(`[REFERRAL-CRON] SUCCESS: Credited KES ${reward} to referrer ${referrer_seller_id} from referred ${referred_seller_id} (GMV: ${gmv})`);

                // 6. WhatsApp notification (async, non-blocking)
                ReferralService._notifyReferrer(referrer_seller_id, referred_shop_name, reward).catch(err =>
                    logger.error(`[REFERRAL-CRON] WhatsApp notify failed for seller ${referrer_seller_id}:`, err.message)
                );
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            logger.error('[REFERRAL-CRON] Transaction failed, rolled back:', err);
            throw err;
        } finally {
            client.release();
        }

        logger.info(`[REFERRAL-CRON] ✅ Done — processed: ${processed}, total credited: KES ${totalCredited}`);
        return { processed, totalCredited };
    }

    // ─── Private Helpers ────────────────────────────────────────────────────────

    /**
     * Send a WhatsApp reward notification to the referrer.
     * @private
     * @param {number} referrerSellerId
     * @param {string} referredShopName
     * @param {number} amount
     */
    static async _notifyReferrer(referrerSellerId, referredShopName, amount) {
        const seller = await Seller.findById(referrerSellerId);

        const phone = seller?.whatsapp_number;
        if (!phone) return;

        // @ts-ignore
        const { default: whatsappService } = await import('./whatsapp.service.js');
        const message = `💛 Byblos: You earned KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${referredShopName}'s sales this month. Keep building your squad!`;
        // @ts-ignore
        await whatsappService.sendMessage(phone, message);
        logger.info(`[REFERRAL] WhatsApp reward notification sent to seller ${referrerSellerId}`);
    }
}

export default ReferralService;
