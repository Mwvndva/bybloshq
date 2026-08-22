import { PaymentStatus } from '../constants/enums.js';
import { getProviderPayloadData } from './providerReference.js';

const PAYMENT_STATUS_MAP = new Map([
    ['success', PaymentStatus.COMPLETED],
    ['successful', PaymentStatus.COMPLETED],
    ['completed', PaymentStatus.COMPLETED],
    ['paid', PaymentStatus.COMPLETED],
    ['failed', PaymentStatus.FAILED],
    ['failure', PaymentStatus.FAILED],
    ['abandoned', PaymentStatus.FAILED],
    ['reversed', PaymentStatus.COMPENSATION_REQUIRED],
    ['pending', PaymentStatus.PENDING],
    ['ongoing', PaymentStatus.PENDING],
    ['processing', PaymentStatus.PENDING],
    ['pay_offline', PaymentStatus.PENDING],
    ['send_otp', PaymentStatus.PENDING],
    ['send_phone', PaymentStatus.PENDING],
    ['send_birthday', PaymentStatus.PENDING],
    ['open_url', PaymentStatus.PENDING]
]);

function normalizeRawStatus(value) {
    return String(value || '').trim().toLowerCase();
}

function extractPaystackPaymentStatus(input = {}) {
    if (typeof input === 'string') return input;
    const data = getProviderPayloadData(input);
    const event = normalizeRawStatus(input.event || data.event);

    if (event === 'charge.success') return 'success';
    if (event === 'charge.failed') return 'failed';
    if (event === 'charge.abandoned') return 'abandoned';

    return data.status || input.status || input.gateway_response || '';
}

export function normalizePaystackPaymentStatus(input = {}) {
    const rawStatus = normalizeRawStatus(extractPaystackPaymentStatus(input));
    return PAYMENT_STATUS_MAP.get(rawStatus) || PaymentStatus.PENDING;
}

export function normalizePaystackPaymentAmount(rawPayload = {}) {
    const data = getProviderPayloadData(rawPayload);
    const rawAmount = data.amount ?? rawPayload.amount;
    const amountSubunit = Number.parseInt(rawAmount, 10);
    const amount = Number.isFinite(amountSubunit)
        ? Math.round(amountSubunit) / 100
        : Number.parseFloat(data.amount_major ?? rawPayload.amount_major);

    return {
        amount,
        rawAmount,
        paystackAmountSubunit: Number.isFinite(amountSubunit) ? amountSubunit : null
    };
}

export function normalizePaystackChargePayload(rawPayload = {}, explicitReference = null) {
    const root = rawPayload || {};
    const details = root.data && typeof root.data === 'object' ? root.data : root;
    const status = normalizePaystackPaymentStatus(root);
    const { amount, rawAmount, paystackAmountSubunit } = normalizePaystackPaymentAmount(root);
    const reference = explicitReference
        || details.reference
        || root.reference
        || details.transaction_reference
        || root.transaction_reference
        || details.api_ref
        || root.api_ref
        || null;

    return {
        ...root,
        ...details,
        success: status === PaymentStatus.COMPLETED,
        transaction_id: reference,
        reference,
        provider_reference: reference,
        transaction_reference: reference,
        status,
        amount,
        raw_amount: rawAmount,
        paystack_amount_subunit: paystackAmountSubunit,
        currency: details.currency || root.currency || 'KES',
        phone_number: details.customer?.phone || details.authorization?.receiver_bank_account_number || null,
        email: details.customer?.email || details.email || root.email || null,
        paid_at: details.paid_at || details.paidAt || null,
        channel: details.channel || root.channel || 'mobile_money',
        gateway_response: details.gateway_response || root.gateway_response || null,
        mpesa_receipt: details.receipt_number || root.receipt_number || null,
        raw_response: root,
        data: {
            ...details,
            amount,
            raw_amount: rawAmount,
            paystack_amount_subunit: paystackAmountSubunit,
            status,
            reference,
            transaction_reference: reference,
            provider_reference: reference
        }
    };
}

export default {
    normalizePaystackPaymentStatus,
    normalizePaystackPaymentAmount,
    normalizePaystackChargePayload
};
