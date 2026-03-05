/**
 * Custom error class for Payd API errors
 */
export class PaydError extends Error {
    constructor(message, code, statusCode = 500, details = {}) {
        super(message);
        this.name = 'PaydError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }

    toJSON() {
        return {
            success: false,
            error: {
                message: this.message,
                code: this.code,
                status: this.statusCode,
                details: this.details
            }
        };
    }
}

/**
 * Payd error codes
 */
export const PaydErrorCodes = {
    // Configuration errors
    CONFIG_ERROR: 'CONFIG_ERROR',

    // Validation errors
    INVALID_PHONE: 'INVALID_PHONE',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',

    // Network errors
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    TIMEOUT: 'TIMEOUT',

    // API errors
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    TRANSACTION_FAILED: 'TRANSACTION_FAILED',
    TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
    DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',

    // Webhook errors
    WEBHOOK_VALIDATION_FAILED: 'WEBHOOK_VALIDATION_FAILED',

    // Unknown
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};
