import axios from 'axios';
import https from 'https';
import logger from '../utils/logger.js';
import Fees from '../config/fees.js';
import { PaydError, PaydErrorCodes } from '../utils/PaydError.js';

/**
 * PayoutService — Payd Kenya M-Pesa Payouts
 * 
 * API: POST https://api.payd.money/api/v2/withdrawal
 * Auth: HTTP Basic Auth (username:password)
 * Docs: https://magic.payd.money/kenya-payouts
 */
class PayoutService {
    constructor() {
        // Separate base URL for payouts (v2) vs payments (v3)
        this.baseUrl = process.env.PAYD_PAYOUT_BASE_URL || 'https://api.payd.money/api/v2';
        this.payloadUsername = process.env.PAYD_PAYLOAD_USERNAME || process.env.PAYD_USERNAME || 'mwxndx';
        this.accountUsername = this.payloadUsername;
        this.username = process.env.PAYD_USERNAME || this.payloadUsername;
        this.password = process.env.PAYD_PASSWORD;
        this.apiSecret = process.env.PAYD_API_SECRET;


        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ByblosHQ/2.0 (Node.js)'
            },
            timeout: 30000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: true, // Enabled for production security
                keepAlive: true,
                family: 4 // Force IPv4
            })
        });

        logger.info(`[PayoutService] Initialized. Base URL: ${this.baseUrl}`);
    }

    /**
     * Build Basic Auth header
     */
    getAuthHeader() {
        if (!this.username || !this.password) {
            throw new Error('Payd payout credentials (PAYD_USERNAME, PAYD_PASSWORD) not configured');
        }
        return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }

    /**
     * Get payout callback URL
     * SEPARATE from payment callback — uses /api/callbacks/payd-payout
     */
    getCallbackUrl() {
        if (process.env.PAYD_PAYOUT_CALLBACK_URL) {
            return process.env.PAYD_PAYOUT_CALLBACK_URL;
        }
        const base = process.env.BACKEND_URL || 'https://bybloshq.space';
        return `${base}/api/callbacks/payd-payout`;
    }

    /**
     * Normalize phone number for PAYOUT API
     * 
     * Payd payout API requires 0XXXXXXXXX format (10 digits, starts with 0)
     * This is DIFFERENT from the payment (STK push) API which uses 254XXXXXXXXX
     * 
     * @param {string|number} phone
     * @returns {string} e.g. "0712345678"
     */
    normalizePhoneForPayout(phone) {
        let digits = phone.toString().replace(/\D/g, '');

        // Strip country code if present
        if (digits.startsWith('254') && digits.length === 12) {
            digits = '0' + digits.substring(3);
        } else if (digits.startsWith('+254')) {
            digits = '0' + digits.substring(4);
        } else if (digits.length === 9) {
            // Bare 9-digit number e.g. 712345678
            digits = '0' + digits;
        }

        if (!digits.startsWith('0') || digits.length !== 10) {
            throw new Error(
                `Invalid phone number format: "${phone}". ` +
                `Payout requires a 10-digit Kenyan number starting with 0 (e.g. 0712345678)`
            );
        }

        return digits;
    }

    /**
     * Validate withdrawal amount against Payd limits
     * @param {number} amount
     * @returns {number} validated amount
     */
    validateAmount(amount) {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            throw new Error('Invalid withdrawal amount');
        }
        if (parsed < Fees.MIN_WITHDRAWAL_AMOUNT) {
            throw new Error(`Minimum withdrawal amount is KES ${Fees.MIN_WITHDRAWAL_AMOUNT}`);
        }
        if (parsed > Fees.MAX_WITHDRAWAL_AMOUNT) {
            throw new Error(`Maximum withdrawal amount is KES ${Fees.MAX_WITHDRAWAL_AMOUNT.toLocaleString()}`);
        }
        return parsed;
    }

    /**
     * Initiate a Kenya M-Pesa payout via Payd
     * 
     * @param {Object} params
     * @param {string} params.phone_number - Raw phone (will be normalized)
     * @param {number} params.amount - Amount in KES
     * @param {string} params.narration - Description shown to recipient
     * @returns {Promise<{correlator_id: string, message: string, status: string}>}
     */
    /**
     * Initiate M-Pesa B2C Payout
     * 
     * Endpoint: POST https://api.payd.money/api/v2/withdrawal
     * Auth: Basic Auth
     * Docs: https://magic.payd.one/kenya-payouts
     * 
     * @param {Object} params
     * @param {string} params.phone_number - 0XXXXXXXXX format
     * @param {number} params.amount - Amount in KES
     * @param {string} params.narration - Description for recipient
     * @param {string} [params.callback_url] - Webhook URL
     * @returns {Promise<Object>}
     */
    async initiatePayout({ phone_number, amount, narration, callback_url }) {
        const startTime = Date.now();

        try {
            // ============================================================
            // STEP 1: VALIDATE INPUTS
            // ============================================================
            const validatedAmount = this.validateAmount(amount);
            const normalizedPhone = this.normalizePhoneForPayout(phone_number);
            const callbackUrl = callback_url || this.getCallbackUrl();

            logger.info('[PAYD-PAYOUT] Initiating payout', {
                phone: normalizedPhone,
                amount: validatedAmount,
                narration
            });

            // ============================================================
            // STEP 2: CHECK BALANCE (Optional but recommended)
            // ============================================================
            try {
                const balance = await this.checkPayoutBalance();

                if (parseFloat(balance.available_balance) < validatedAmount) {
                    throw new PaydError(
                        `Insufficient payout balance. Available: ${balance.available_balance}, Required: ${validatedAmount}`,
                        PaydErrorCodes.INSUFFICIENT_BALANCE
                    );
                }

                logger.info('[PAYD-PAYOUT] Balance check passed', {
                    available: balance.available_balance,
                    required: validatedAmount
                });

            } catch (balanceError) {
                // Don't block if balance check fails (might be network issue)
                if (balanceError.code === PaydErrorCodes.INSUFFICIENT_BALANCE) {
                    throw balanceError;
                }
                logger.debug('[PAYD-PAYOUT] Balance check failed (non-critical)', balanceError.message);
            }

            // ============================================================
            // STEP 3: BUILD PAYOUT REQUEST
            // ============================================================
            const payload = {
                phone_number: normalizedPhone,
                amount: validatedAmount,
                narration: narration || 'Payout from ByblosHQ',
                callback_url: callbackUrl,
                channel: 'MPESA',
                currency: 'KES'
            };

            // ============================================================
            // STEP 4: MAKE API REQUEST
            // ============================================================
            const response = await this._retryRequest(async () => {
                return await this.client.post('/withdrawal', payload, {
                    headers: {
                        'Authorization': this.getAuthHeader(),
                        'X-Payd-Secret': this.apiSecret,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

            }, 3, 2000); // 3 retries with 2s delay

            const duration = Date.now() - startTime;

            // ============================================================
            // STEP 5: PARSE RESPONSE
            // ============================================================
            const data = response.data;
            const reference = data.correlator_id;

            if (!reference) {
                logger.warn('[PAYD-PAYOUT] No correlator_id in response', { data });
            }

            logger.info('[PAYD-PAYOUT] Payout initiated successfully', {
                duration: `${duration}ms`,
                reference: reference,
                status: data.status,
                message: data.message
            });

            return {
                success: true,
                transaction_reference: reference,
                transaction_id: reference,
                status: data.status || 'processing',
                message: data.message || 'Payout initiated',
                original_response: data
            };

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('[PAYD-PAYOUT] Payout initiation failed', {
                duration: `${duration}ms`,
                phone: phone_number,
                amount,
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }

    }

    /**
     * Retry request with exponential backoff
     * 
     * @private
     * @param {Function} requestFn - Async function that makes the request
     * @param {number} maxRetries - Maximum retry attempts
     * @param {number} initialDelayMs - Initial delay in milliseconds
     * @returns {Promise<any>}
     */
    async _retryRequest(requestFn, maxRetries = 3, initialDelayMs = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                // Don't retry for client errors (4xx)
                if (error.response?.status >= 400 && error.response?.status < 500) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    const delay = initialDelayMs * Math.pow(2, attempt - 1);
                    logger.warn(`[PAYD-RETRY] Attempt ${attempt} failed, retrying in ${delay}ms`, {
                        error: error.message
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Check payout transaction status
     * 
     * Note: Payd v2 payout API may not have a dedicated status endpoint.
     * This method is a placeholder for when/if Payd adds this feature.
     * 
     * @param {string} correlatorId - Payd correlator_id from payout initiation
     * @returns {Promise<Object>}
     */
    async checkPayoutStatus(correlatorId) {
        try {
            logger.info('[PAYD-PAYOUT-STATUS] Checking payout status', {
                correlator_id: correlatorId
            });

            // Attempt to check status (endpoint may or may not exist)
            const response = await this.client.get(`/withdrawal/${correlatorId}/status`, {
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            const data = response.data;

            logger.info('[PAYD-PAYOUT-STATUS] Status retrieved', {
                correlator_id: correlatorId,
                status: data.status
            });

            return {
                success: true,
                correlator_id: correlatorId,
                status: data.status,
                amount: data.amount,
                phone_number: data.phone_number,
                created_at: data.created_at,
                completed_at: data.completed_at,
                raw_response: data
            };

        } catch (error) {
            // If endpoint doesn't exist (404), return a helpful message
            if (error.response?.status === 404) {
                logger.warn('[PAYD-PAYOUT-STATUS] Status endpoint not available for payouts');
                return {
                    success: false,
                    message: 'Payout status checking not available in Payd v2 API',
                    fallback: 'Use webhook callbacks for status updates'
                };
            }

            logger.error('[PAYD-PAYOUT-STATUS] Status check failed', {
                correlator_id: correlatorId,
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }
    }

    /**
     * Check Payd payout account balance
     * 
     * Endpoint: GET https://api.payd.money/api/v1/accounts/{username}/all_balances
     * Auth: Basic Auth
     * 
     * @returns {Promise<Object>}
     */
    async checkPayoutBalance() {
        try {
            logger.info('[PAYD-PAYOUT-BALANCE] Checking payout balance');

            const response = await this.client.get(`/accounts/${this.username}/all_balances`, {
                baseURL: 'https://api.payd.money/api/v1',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            const data = response.data;
            const fiat = data.fiat_balance || {};

            logger.info('[PAYD-PAYOUT-BALANCE] Balance retrieved', {
                available: fiat.balance,
                currency: fiat.currency
            });

            return {
                success: true,
                available_balance: fiat.balance,
                ledger_balance: fiat.balance, // Unified in v1
                currency: fiat.currency || 'KES',
                last_updated: new Date().toISOString(),
                raw_response: data
            };

        } catch (error) {
            logger.error('[PAYD-PAYOUT-BALANCE] Balance check failed', {
                error: this._extractErrorDetails(error)
            });

            throw this._handlePaydError(error);
        }
    }

    /**
     * Extract error details from Axios error
     * 
     * @private
     * @param {Error} error - Axios error object
     * @returns {Object}
     */
    _extractErrorDetails(error) {
        if (error.response) {
            return {
                type: 'http_error',
                status: error.response.status,
                data: error.response.data
            };
        } else if (error.request) {
            return {
                type: 'no_response',
                message: error.message
            };
        } else {
            return {
                type: 'request_setup',
                message: error.message
            };
        }
    }

    /**
     * Handle Payd API errors and convert to PaydError
     * 
     * @private
     * @param {Error} error - Original error
     * @returns {PaydError}
     */
    _handlePaydError(error) {
        if (error instanceof PaydError) return error;

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 401 || status === 403) {
                return new PaydError('Authentication failed', PaydErrorCodes.AUTHENTICATION_FAILED, 401, { original: data });
            }
            if (status === 404) {
                return new PaydError('Not found', PaydErrorCodes.TRANSACTION_NOT_FOUND, 404, { original: data });
            }
            return new PaydError(data.message || 'Payd API error', PaydErrorCodes.TRANSACTION_FAILED, status, { original: data });
        }

        return new PaydError(error.message, PaydErrorCodes.UNKNOWN_ERROR, 500, { original: error });
    }

    /**
     * Refund a failed withdrawal back to the entity's wallet balance.
     * Called inside a DB transaction.
     * 
     * @param {Object} client - Active DB transaction client
     * @param {Object} request - withdrawal_requests row
     * @returns {Promise<number|null>} newBalance
     */
    async refundToWallet(client, request) {
        const amount = parseFloat(request.amount);
        let newBalance = null;

        if (request.seller_id) {
            const { rows } = await client.query(
                'UPDATE sellers SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
                [amount, request.seller_id]
            );
            newBalance = parseFloat(rows[0]?.balance ?? 0);
            logger.info(`[PayoutService] Refunded KES ${amount} to seller ${request.seller_id}. New balance: ${newBalance}`);

        } else {
            logger.error('[PayoutService] Cannot refund: no seller_id on request', request);
        }

        return newBalance;
    }
}


export default new PayoutService();
