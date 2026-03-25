import { generateToken } from '../utils/csrf.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Controller to provide a CSRF token to the frontend.
 * Also sets a stable session identifier cookie if one doesn't exist.
 */
export const getCsrfToken = (req, res) => {
    try {
        // 1. Ensure a stable session identifier exists
        let sessionId = req.cookies['csrf-session-id'];

        if (!sessionId) {
            sessionId = crypto.randomBytes(32).toString('hex');

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            };

            res.cookie('csrf-session-id', sessionId, cookieOptions);
            // Update req.cookies so generateCsrfToken uses the new ID if it relies on it immediately
            req.cookies['csrf-session-id'] = sessionId;
        }

        // 2. Generate the CSRF token
        // Use the function exposed from CSRF utility
        if (!generateToken) {
            logger.error('CSRF token generator not initialized');
            return res.status(500).json({
                status: 'error',
                message: 'CSRF protection not properly initialized'
            });
        }

        const token = generateToken(req, res);

        // 3. Return the token in the response body
        // The middleware also sets the 'x-csrf-token' cookie automatically
        res.status(200).json({
            status: 'success',
            data: {
                csrfToken: token
            }
        });
    } catch (error) {
        logger.error('Error generating CSRF token:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate CSRF token'
        });
    }
};
