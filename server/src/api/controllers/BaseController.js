import logger from '../../utils/logger.js';

export class BaseController {
    /**
     * Standard success response
     */
    success(res, data, status = 200, extra = {}) {
        return res.status(status).json({
            status: 'success',
            data,
            ...extra
        });
    }

    /**
     * Standard error response
     */
    error(res, message, status = 500, extra = {}) {
        return res.status(status).json({
            status: 'error',
            message,
            ...extra
        });
    }

    /**
     * Wrapper to handle controller logic and catch errors uniformly
     */
    async handle(req, res, action, context = '') {
        try {
            return await action();
        } catch (error) {
            logger.error(`Controller Error [${context}]:`, error);
            const message = error.message || 'An unexpected error occurred';
            const status = error.status || 500;
            return this.error(res, message, status);
        }
    }
}
