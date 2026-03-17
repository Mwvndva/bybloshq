// @ts-check
'use strict';

import ReferralService from '../services/referral.service.js';
import AppError from '../utils/appError.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

/**
 * GET /api/v1/sellers/referral/dashboard
 * Returns the referral dashboard for the authenticated seller.
 */
export const getDashboard = async (req, res, next) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return next(new AppError('Authentication required', 401));

        const dashboard = await ReferralService.getReferralDashboard(sellerId);

        res.status(200).json({
            status: 'success',
            data: dashboard
        });
    } catch (err) {
        logger.error(`[REFERRAL-CTRL] getDashboard error for seller ${req.user?.id}:`, err.message);
        next(err);
    }
};

/**
 * POST /api/v1/sellers/referral/generate-code
 * Generates (or fetches existing) referral code for the authenticated seller.
 * Locked: seller must have total_sales > 0.
 */
export const generateCode = async (req, res, next) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return next(new AppError('Authentication required', 401));

        // Check if seller already has a code — if so, return it directly
        const sellerResult = await pool.query(
            'SELECT referral_code, total_sales FROM sellers WHERE id = $1',
            [sellerId]
        );

        if (sellerResult.rowCount === 0) return next(new AppError('Seller not found', 404));

        const { referral_code, total_sales } = sellerResult.rows[0];

        // Business rule: referral link is locked until the seller has at least one completed sale
        if (!total_sales || parseFloat(total_sales) === 0) {
            return res.status(403).json({
                status: 'fail',
                message: 'Complete your first sale to unlock referrals'
            });
        }

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
        logger.error(`[REFERRAL-CTRL] generateCode error for seller ${req.user?.id}:`, err.message);
        next(err);
    }
};
