import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Simple CSRF Alternative
 * Implements the Double Submit Cookie pattern.
 * A random token is stored in a cookie and must be sent back in a custom header.
 */
export const getCsrfToken = (req, res) => {
    try {
        // ALWAYS generate a fresh token when this endpoint is called
        // to ensure frontend and cookie are in absolute sync.
        const token = crypto.randomBytes(32).toString('hex');
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('csrf-token-v2', token, {
            httpOnly: true, // More secure, frontend gets the value from JSON response
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            domain: process.env.COOKIE_DOMAIN || undefined
        });

        logger.info(`[CSRF] Issued new token: ${token.substring(0, 8)}...`);

        res.status(200).json({
            status: 'success',
            data: {
                csrfToken: token
            }
        });
    } catch (error) {
        logger.error('Error generating simple CSRF token:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate security token'
        });
    }
};
