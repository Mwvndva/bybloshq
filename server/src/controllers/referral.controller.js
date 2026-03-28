// @ts-check
'use strict';

import ReferralService from '../services/referral.service.js';
import { AppError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

/**
 * GET /api/v1/sellers/referral/dashboard
 * Returns the referral dashboard for the authenticated seller.
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
export const getDashboard = async (req, res, next) => {
    try {
        const sellerId = req.user?.sellerId;
        if (!sellerId) {
            return next(new AppError('No seller profile linked to this account', 400));
        }


        const dashboard = await ReferralService.getReferralDashboard(sellerId);

        res.status(200).json({
            status: 'success',
            data: dashboard
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[REFERRAL-CTRL] getDashboard error for seller ${req.user?.id}:`, message);
        next(err);
    }
};

/**
 * POST /api/v1/sellers/referral/generate-code
 * Generates (or fetches existing) referral code for the authenticated seller.
 * Locked: seller must have total_sales > 0.
 * @param {any} req
 * @param {any} res
 * @param {any} next
 */
export const generateCode = async (req, res, next) => {
    try {
        const sellerId = req.user?.sellerId;
        if (!sellerId) {
            return next(new AppError('No seller profile linked to this account', 400));
        }


        // Check if seller already has a code — if so, return it directly
        const sellerResult = await pool.query(
            'SELECT referral_code, total_sales FROM sellers WHERE id = $1',
            [sellerId]
        );

        if (sellerResult.rowCount === 0) return next(new AppError('Seller not found', 404));

        const { referral_code, total_sales } = sellerResult.rows[0];

        // Let the service handle the business logic (sales lock, code generation, etc.)
        // the generateReferralCode method will throw if rules are not met.

        // Already has a code — no-op
        if (referral_code) {
            return res.status(200).json({
                status: 'success',
                data: {
                    referralCode: referral_code,
                    referralLink: ReferralService.getReferralLink(referral_code)
                }
            });
        }

        // Generate a new one
        const code = await ReferralService.generateReferralCode(sellerId);
        const link = ReferralService.getReferralLink(code);

        res.status(201).json({
            status: 'success',
            data: {
                referralCode: code,
                referralLink: link
            }
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[REFERRAL-CTRL] generateCode error for seller ${req.user?.id}:`, message);
        next(err);
    }
};
