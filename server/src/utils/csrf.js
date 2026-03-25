import { doubleCsrf } from 'csrf-csrf';
import logger from './logger.js';

/**
 * CSRF Protection Utility
 */

logger.info('🛡️ CSRF Utility: Initializing...');
logger.info(`🛡️ CSRF Utility: Secret length: ${(process.env.CSRF_SECRET || '').length}`);

let doubleCsrfResult;
try {
    doubleCsrfResult = doubleCsrf({
        getSecret: () => process.env.CSRF_SECRET || 'byblos-default-csrf-secret-change-me',
        getSessionIdentifier: (req) => {
            return req.cookies['csrf-session-id'] || req.ip || 'anonymous';
        },
        cookieName: 'x-csrf-token',
        cookieOptions: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
        },
        size: 64,
        ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
        getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
    });
    logger.info(`🛡️ CSRF Utility: Successfully called doubleCsrf. Keys: ${Object.keys(doubleCsrfResult).join(', ')}`);
} catch (err) {
    logger.error('🛡️ CSRF Utility: Initialization FAILED:', err);
    throw err;
}

export const {
    generateToken,
    doubleCsrfProtection,
    invalidCsrfTokenError,
} = doubleCsrfResult;
