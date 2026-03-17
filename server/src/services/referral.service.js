// @ts-check
'use strict';

import { pool } from '../config/database.js';
import Fees from '../config/fees.js';
import logger from '../utils/logger.js';
import AppError from '../utils/appError.js';

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
        const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        let code;
        let attempts = 0;
        const MAX_ATTEMPTS = 10;

        while (attempts < MAX_ATTEMPTS) {
            let suffix = '';
            for (let i = 0; i < 6; i++) {
                suffix += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
            }
            code = `BY${suffix}`;

            // Check uniqueness before saving
            const existing = await pool.query(
                'SELECT id FROM sellers WHERE referral_code = $1',
                [code]
            );
            if (existing.rowCount === 0) break; // unique!
            attempts++;
        }

        if (!code) throw new AppError('Failed to generate unique referral code', 500);

        await pool.query(
            'UPDATE sellers SET referral_code = $1 WHERE id = $2',
            [code, sellerId]
        );

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
        const referrerResult = await pool.query(
            'SELECT id FROM sellers WHERE referral_code = $1',
            [referralCode]
        );

        if (referrerResult.rowCount === 0) {
            throw new AppError(`No seller found with referral code: ${referralCode}`, 404);
        }

        const referrerId = referrerResult.rows[0].id;

        // Guard: prevent self-referral
        if (referrerId === newSellerId) {
            logger.warn(`[REFERRAL] Seller ${newSellerId} tried to use their own referral code`);
            return;
        }

        await pool.query(
            'UPDATE sellers SET referred_by_seller_id = $1 WHERE id = $2 AND referred_by_seller_id IS NULL',
            [referrerId, newSellerId]
        );

        logger.info(`[REFERRAL] Seller ${newSellerId} referred by seller ${referrerId} (code: ${referralCode})`);
    }

    // ─── First-Sale Activation Hook ─────────────────────────────────────────────

    /**
     * Called after a referred seller completes their FIRST paid order.
     * Sets referral_active_until = NOW() + 6 months.
     * @param {number} referredSellerId
     */
    static async activateReferral(referredSellerId) {
        const result = await pool.query(
            `UPDATE sellers
       SET referral_active_until = NOW() + INTERVAL '6 months'
       WHERE id = $1
         AND referred_by_seller_id IS NOT NULL
         AND referral_active_until IS NULL
       RETURNING id, referral_active_until`,
            [referredSellerId]
        );

        if (result.rowCount > 0) {
            logger.info(`[REFERRAL] Activated referral for seller ${referredSellerId} — expires ${result.rows[0].referral_active_until}`);
        }
    }

    // ─── Dashboard Data ─────────────────────────────────────────────────────────

    /**
     * Returns the full referral dashboard payload for a referrer seller.
     * @param {number} referrerSellerId
     */
    static async getReferralDashboard(referrerSellerId) {
        // 1. Fetch referrer's own code and total earnings
        const referrerResult = await pool.query(
            `SELECT referral_code, total_referral_earnings
       FROM sellers WHERE id = $1`,
            [referrerSellerId]
        );

        if (referrerResult.rowCount === 0) {
            throw new AppError('Seller not found', 404);
        }

        const { referral_code, total_referral_earnings } = referrerResult.rows[0];
        const referralLink = referral_code ? ReferralService.getReferralLink(referral_code) : null;

        // 2. Fetch referred sellers with aggregated earnings
        const squadResult = await pool.query(
            `SELECT
         s.id,
         s.shop_name,
         s.referral_active_until,
         COALESCE(SUM(rel.reward_amount), 0) AS total_earned
       FROM sellers s
       LEFT JOIN referral_earnings_log rel
         ON rel.referred_seller_id = s.id AND rel.referrer_seller_id = $1
       WHERE s.referred_by_seller_id = $1
       GROUP BY s.id, s.shop_name, s.referral_active_until
       ORDER BY total_earned DESC`,
            [referrerSellerId]
        );

        const now = new Date();
        const referred = squadResult.rows.map(row => ({
            id: row.id,
            shopName: row.shop_name,
            referralActiveUntil: row.referral_active_until,
            isActive: row.referral_active_until ? new Date(row.referral_active_until) > now : false,
            totalEarned: parseFloat(row.total_earned)
        }));

        return {
            referralCode: referral_code,
            referralLink,
            totalReferralEarnings: parseFloat(total_referral_earnings || 0),
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
        const activeReferrals = await pool.query(
            `SELECT
         s.id           AS referred_seller_id,
         s.shop_name    AS referred_shop_name,
         s.referred_by_seller_id AS referrer_seller_id
       FROM sellers s
       WHERE s.referred_by_seller_id IS NOT NULL
         AND s.referral_active_until > NOW()`,
        );

        if (activeReferrals.rowCount === 0) {
            logger.info('[REFERRAL-CRON] No active referrals found — nothing to process');
            return { processed: 0, totalCredited: 0 };
        }

        let processed = 0;
        let totalCredited = 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const row of activeReferrals.rows) {
                const { referred_seller_id, referred_shop_name, referrer_seller_id } = row;

                // 1. Calculate GMV for the referred seller in the target month/year
                const gmvResult = await client.query(
                    `SELECT COALESCE(SUM(total_amount), 0) AS gmv
           FROM product_orders
           WHERE seller_id = $1
             AND payment_status = 'completed'
             AND EXTRACT(MONTH FROM paid_at) = $2
             AND EXTRACT(YEAR FROM paid_at) = $3`,
                    [referred_seller_id, month, year]
                );

                const gmv = parseFloat(gmvResult.rows[0].gmv);
                if (gmv <= 0) continue;

                // 2. Calculate reward
                const reward = parseFloat((gmv * Fees.REFERRAL_REWARD_RATE).toFixed(2));

                // 3. Skip sub-1 KES rewards
                if (reward < 1) {
                    logger.info(`[REFERRAL-CRON] Skipping seller ${referred_seller_id} — reward ${reward} KES below minimum`);
                    continue;
                }

                // 4. Insert log row (idempotent)
                const insertResult = await client.query(
                    `INSERT INTO referral_earnings_log
             (referrer_seller_id, referred_seller_id, period_month, period_year, referred_gmv, reward_amount)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (referrer_seller_id, referred_seller_id, period_month, period_year) DO NOTHING`,
                    [referrer_seller_id, referred_seller_id, month, year, gmv, reward]
                );

                if (insertResult.rowCount === 0) {
                    logger.info(`[REFERRAL-CRON] Already processed referrer ${referrer_seller_id} / referred ${referred_seller_id} for ${year}-${month} — skipping`);
                    continue;
                }

                // 5. Credit referrer's balance
                await client.query(
                    `UPDATE sellers
           SET balance = balance + $1,
               total_referral_earnings = total_referral_earnings + $1
           WHERE id = $2`,
                    [reward, referrer_seller_id]
                );

                processed++;
                totalCredited = parseFloat((totalCredited + reward).toFixed(2));

                logger.info(`[REFERRAL-CRON] Credited KES ${reward} to referrer ${referrer_seller_id} from referred ${referred_seller_id} (GMV: ${gmv})`);

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
     */
    static async _notifyReferrer(referrerSellerId, referredShopName, amount) {
        const sellerResult = await pool.query(
            'SELECT whatsapp_number FROM sellers WHERE id = $1',
            [referrerSellerId]
        );

        const phone = sellerResult.rows[0]?.whatsapp_number;
        if (!phone) return;

        const { default: whatsappService } = await import('./whatsapp.service.js');
        const message = `💛 Byblos: You earned KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${referredShopName}'s sales this month. Keep building your squad!`;
        await whatsappService.sendMessage(phone, message);
        logger.info(`[REFERRAL] WhatsApp reward notification sent to seller ${referrerSellerId}`);
    }
}

export default ReferralService;
