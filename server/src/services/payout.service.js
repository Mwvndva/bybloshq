import crypto from 'crypto';
import logger from '../shared/utils/logger.js';
import Fees from '../config/fees.js';
import PaystackTransferClient from '../providers/PaystackTransferClient.js';

const SUPPORTED_PAYOUT_PROVIDERS = new Set(['paystack']);

function resolvePayoutProvider() {
    const configuredProvider = String(process.env.PAYOUT_PROVIDER || 'paystack').trim().toLowerCase();
    if (SUPPORTED_PAYOUT_PROVIDERS.has(configuredProvider)) {
        return configuredProvider;
    }

    logger.warn('[PayoutService] Unsupported PAYOUT_PROVIDER configured; falling back to paystack transfers', {
        configuredProvider,
        supportedProviders: Array.from(SUPPORTED_PAYOUT_PROVIDERS)
    });
    return 'paystack';
}

class PayoutService {
    constructor() {
        this.provider = resolvePayoutProvider();
        this.payoutProviderClient = this._buildProviderClient(this.provider);
        this.transferClient = this.payoutProviderClient;
        logger.info('[PayoutService] Initialized payout provider', {
            provider: this.provider,
            baseUrl: this.transferClient.baseUrl
        });
    }

    _buildProviderClient(provider) {
        if (provider === 'paystack') {
            return new PaystackTransferClient();
        }

        throw new Error(`Unsupported payout provider: ${provider}`);
    }

    normalizePhoneForPayout(phone) {
        if (!phone) throw new Error('Phone number is required for payout');
        let digits = phone.toString().replace(/\D/g, '');

        if (digits.startsWith('254') && digits.length === 12) {
            digits = `0${digits.substring(3)}`;
        } else if (digits.length === 9 && /^[17]/.test(digits)) {
            digits = `0${digits}`;
        } else if (digits.startsWith('0') && digits.length === 10) {
            // already in local display/storage format
        } else {
            throw new Error(`Invalid phone number format: "${phone}". Payout requires a valid Kenyan number.`);
        }

        if (!/^0[17]\d{8}$/.test(digits)) {
            throw new Error(`"${digits}" is not a valid Kenyan mobile number. Must start with 07 or 01.`);
        }

        return digits;
    }

    validateAmount(amount) {
        const parsed = Number.parseFloat(amount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
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

    async initiatePayout({ phone_number, amount, narration, idempotency_key, recipient_name }) {
        const validatedAmount = this.validateAmount(amount);
        const normalizedPhone = this.normalizePhoneForPayout(phone_number);
        const reference = typeof idempotency_key === 'string' && idempotency_key.trim()
            ? idempotency_key.trim().slice(0, 120)
            : `po-${crypto.randomUUID()}`;

        try {
            const result = await this.transferClient.initiateTransfer({
                amount: validatedAmount,
                phoneNumber: normalizedPhone,
                name: recipient_name || normalizedPhone,
                narration: narration || 'Byblos seller withdrawal',
                reference
            });

            logger.info('[PAYSTACK-TRANSFER] Payout initiated successfully', {
                reference: result.reference,
                transferCode: result.transfer_code,
                amount: validatedAmount
            });

            return {
                ...result,
                provider: this.provider,
                correlator_id: result.reference,
                transaction_reference: result.reference,
                provider_reference: result.reference,
                client_reference: reference,
                phone_number: normalizedPhone,
                amount: validatedAmount,
                message: result.message || 'Transfer request accepted'
            };
        } catch (error) {
            logger.error('[PAYSTACK-TRANSFER] Payout initiation failed', {
                phone: normalizedPhone,
                amount: validatedAmount,
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            throw this._handleProviderError(error);
        }
    }

    async checkPayoutStatus(reference) {
        const result = await this.transferClient.verifyTransfer(reference);
        return {
            ...result,
            provider: this.provider,
            correlator_id: result.reference,
            transaction_reference: result.reference,
            provider_reference: result.reference
        };
    }

    async checkPayoutBalance() {
        return this.transferClient.checkBalance();
    }

    _extractErrorDetails(error) {
        return {
            message: error.message,
            code: error.code,
            status: error.statusCode || error.response?.status,
            data: error.details || error.response?.data || null,
            provider: this.provider
        };
    }

    _handleProviderError(error) {
        const wrapped = new Error(error.response?.data?.message || error.message || 'Paystack transfer request failed');
        wrapped.code = error.code || error.response?.data?.code || 'PAYSTACK_TRANSFER_ERROR';
        wrapped.statusCode = error.statusCode || error.response?.status || 500;
        wrapped.details = error.details || error.response?.data || null;
        wrapped.provider = this.provider;
        return wrapped;
    }

    async refundToWallet(client, request) {
        const amount = Number.parseFloat(request.amount);
        let newBalance = null;

        if (request.seller_id) {
            const { rows } = await client.query(
                'UPDATE sellers SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
                [amount, request.seller_id]
            );
            newBalance = Number.parseFloat(rows[0]?.balance ?? 0);
            logger.info(`[PayoutService] Refunded KES ${amount} to seller ${request.seller_id}. New balance: ${newBalance}`);
        } else {
            logger.error('[PayoutService] Cannot refund: withdrawal has no seller_id', {
                requestId: request.id
            });
        }

        return newBalance;
    }
}

export default new PayoutService();
