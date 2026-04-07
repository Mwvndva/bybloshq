/**
 * withdrawal.controller.js
 */

import WithdrawalService from '../services/withdrawal.service.js';
import payoutService from '../services/payout.service.js';
import { sanitizeWithdrawalRequest } from '../utils/sanitize.js';
import { AppError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

function validateWithdrawalBody(body) {
    const { amount, mpesaNumber, mpesaName } = body;
    if (!amount || !mpesaNumber || !mpesaName) {
        return 'amount, mpesaNumber and mpesaName are required';
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return 'amount must be a positive number';
    try {
        payoutService.validateAmount(parsed);
    } catch (err) {
        return err.message;
    }
    if (typeof mpesaName !== 'string' || !mpesaName.trim()) {
        return 'mpesaName must be a non-empty string';
    }

    // Validate proper Kenyan mobile number format (0XXXXXXXXX — 10 digits, 07XX or 01XX)
    const digits = String(mpesaNumber).replace(/\D/g, '');
    let normalized = digits;

    // Normalize: 254XXXXXXXXX → 0XXXXXXXXX
    if (normalized.startsWith('254') && normalized.length === 12) {
        normalized = '0' + normalized.substring(3);
    }

    // Must be 10 digits starting with 07 or 01
    if (!/^0[17]\d{8}$/.test(normalized)) {
        return 'mpesaNumber must be a valid Kenyan mobile number (e.g. 0712345678 or 0112345678)';
    }

    return null;
}

function statusFromError(message) {
    if (/insufficient/i.test(message)) return 400;
    if (/minimum|maximum/i.test(message)) return 400;
    if (/not found|unauthorized/i.test(message)) return 404;
    if (/invalid/i.test(message)) return 400;
    return 500;
}

export const createWithdrawal = async (req, res, next) => {
    const sellerId = req.user?.sellerId;
    if (!sellerId) return next(new AppError('Authentication required', 401));

    const validationError = validateWithdrawalBody(req.body);
    if (validationError) return next(new AppError(validationError, 400));

    const { amount, mpesaNumber, mpesaName } = req.body;
    try {
        // Standardize phone normalization for Kenyan mobile numbers (v2026/02/08 standard)
        let normalizedPhone = mpesaNumber.replace(/\s+/g, '');
        if (normalizedPhone.startsWith('0')) normalizedPhone = '254' + normalizedPhone.substring(1);
        if (normalizedPhone.startsWith('+')) normalizedPhone = normalizedPhone.substring(1);

        const request = await WithdrawalService.createWithdrawalRequest({
            entityId: sellerId,
            entityType: 'seller',
            amount: parseFloat(amount),
            mpesaNumber: normalizedPhone,
            mpesaName,
        });
        // Improved validation for Kenyan mobile numbers (starts with 07 or 01)
        const phoneRegex = /^(07|01)\d{8}$|^254(7|1)\d{8}$|^\+254(7|1)\d{8}$/;
        if (!phoneRegex.test(mpesaNumber)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid M-Pesa number. Please provide a valid Kenyan mobile number (e.g., 0712345678 or 0112345678).'
            });
        }
        logger.info(`[WithdrawalCtrl] Request ${request.id} created for seller ${sellerId}`);
        return res.status(201).json({
            status: 'success',
            message: 'Withdrawal request submitted. You will be notified via WhatsApp once processed.',
            data: sanitizeWithdrawalRequest({ ...request, message: 'Your request is being processed.' }),
        });
    } catch (err) {
        logger.error(`[WithdrawalCtrl] createWithdrawal failed for seller ${sellerId}:`, err.message);
        return next(new AppError(err.message, statusFromError(err.message)));
    }
};

export const getWithdrawals = async (req, res, next) => {
    const sellerId = req.user?.sellerId;
    if (!sellerId) return next(new AppError('Authentication required', 401));

    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit ?? '20', 10) || 20);
    const offset = (page - 1) * limit;

    const ALLOWED_STATUSES = new Set(['processing', 'completed', 'failed']);
    const statusFilter = ALLOWED_STATUSES.has(req.query.status) ? req.query.status : null;

    try {
        const { rows, total } = await WithdrawalService.getWithdrawalsForSeller(
            sellerId, { limit, offset, status: statusFilter },
        );
        return res.status(200).json({
            status: 'success',
            data: rows.map(r => sanitizeWithdrawalRequest(r)),
            meta: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        logger.error(`[WithdrawalCtrl] getWithdrawals failed for seller ${sellerId}:`, err.message);
        return next(new AppError('Failed to fetch withdrawal requests', 500));
    }
};

export const getWithdrawalById = async (req, res, next) => {
    const sellerId = req.user?.sellerId;
    const requestId = parseInt(req.params.id, 10);
    if (!sellerId) return next(new AppError('Authentication required', 401));
    if (isNaN(requestId)) return next(new AppError('Invalid request ID', 400));

    try {
        const request = await WithdrawalService.getWithdrawalById(requestId, sellerId);
        if (!request) return next(new AppError('Withdrawal request not found', 404));
        return res.status(200).json({ status: 'success', data: sanitizeWithdrawalRequest(request) });
    } catch (err) {
        logger.error(`[WithdrawalCtrl] getWithdrawalById failed:`, err.message);
        return next(new AppError('Failed to fetch withdrawal request', 500));
    }
};
