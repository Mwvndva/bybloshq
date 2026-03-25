import { doubleCsrf } from 'csrf-csrf';
import cookieParser from 'cookie-parser';

/**
 * CSRF Protection Utility
 * 
 * Initialized here to avoid circular dependencies between 
 * loaders/express.js and controllers/csrf.controller.js
 */

console.log('🛡️ CSRF Utility: Initializing with secret length:', (process.env.CSRF_SECRET || 'default').length);

const doubleCsrfResult = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'byblos-default-csrf-secret-change-me',
    getSessionIdentifier: (req) => {
        // Use a persistent identifier if possible (like a session cookie)
        // If not available, fallback to IP
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

console.log('🛡️ CSRF Utility: Successfully called doubleCsrf. Keys returned:', Object.keys(doubleCsrfResult));

export const {
    generateToken,
    doubleCsrfProtection,
    invalidCsrfTokenError,
} = doubleCsrfResult;
