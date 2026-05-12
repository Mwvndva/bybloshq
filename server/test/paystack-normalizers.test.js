import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentStatus } from '../src/shared/constants/enums.js';
import {
    normalizePaystackChargePayload,
    normalizePaystackPaymentStatus
} from '../src/shared/utils/paystackPaymentNormalizer.js';
import {
    normalizePaystackTransferPayload,
    normalizePaystackTransferStatus
} from '../src/shared/utils/paystackTransferNormalizer.js';

test('Paystack payment statuses map to existing payment_status enum values', () => {
    assert.equal(normalizePaystackPaymentStatus('success'), PaymentStatus.COMPLETED);
    assert.equal(normalizePaystackPaymentStatus('failed'), PaymentStatus.FAILED);
    assert.equal(normalizePaystackPaymentStatus('abandoned'), PaymentStatus.FAILED);
    assert.equal(normalizePaystackPaymentStatus('reversed'), PaymentStatus.COMPENSATION_REQUIRED);
    assert.equal(normalizePaystackPaymentStatus('pending'), PaymentStatus.PENDING);
    assert.equal(normalizePaystackPaymentStatus('ongoing'), PaymentStatus.PENDING);
    assert.equal(normalizePaystackPaymentStatus('processing'), PaymentStatus.PENDING);
    assert.equal(normalizePaystackPaymentStatus('pay_offline'), PaymentStatus.PENDING);
    assert.equal(normalizePaystackPaymentStatus('unknown-new-status'), PaymentStatus.PENDING);
});

test('Paystack charge payload normalization converts subunit amounts once', () => {
    const normalized = normalizePaystackChargePayload({
        event: 'charge.success',
        data: {
            amount: 12345,
            reference: 'BYB-ORDER-123',
            currency: 'KES',
            receipt_number: 'MPE-123'
        }
    });

    assert.equal(normalized.success, true);
    assert.equal(normalized.status, PaymentStatus.COMPLETED);
    assert.equal(normalized.amount, 123.45);
    assert.equal(normalized.raw_amount, 12345);
    assert.equal(normalized.paystack_amount_subunit, 12345);
    assert.equal(normalized.transaction_reference, 'BYB-ORDER-123');
    assert.equal(normalized.data.status, PaymentStatus.COMPLETED);
    assert.equal(normalized.data.amount, 123.45);
});

test('Paystack failed charge keeps gateway response out of short M-Pesa receipt field', () => {
    const gatewayResponse = 'The attempted payment failed because customer does not have sufficient funds.';
    const normalized = normalizePaystackChargePayload({
        event: 'charge.failed',
        data: {
            amount: 1000,
            reference: 'BYB-ORDER-FAILED',
            status: 'failed',
            gateway_response: gatewayResponse
        }
    });

    assert.equal(normalized.success, false);
    assert.equal(normalized.status, PaymentStatus.FAILED);
    assert.equal(normalized.gateway_response, gatewayResponse);
    assert.equal(normalized.mpesa_receipt, null);
});

test('Paystack transfer normalizer keeps payout statuses separate from payment_status', () => {
    assert.equal(normalizePaystackTransferStatus({ event: 'transfer.success' }), 'success');
    assert.equal(normalizePaystackTransferStatus({ event: 'transfer.failed' }), 'failed');
    assert.equal(normalizePaystackTransferStatus({ event: 'transfer.reversed' }), 'failed');
    assert.equal(normalizePaystackTransferStatus({ data: { status: 'reversed' } }), 'failed');
    assert.equal(normalizePaystackTransferStatus({ data: { status: 'pending' } }), 'pending');

    const normalized = normalizePaystackTransferPayload({
        event: 'transfer.success',
        data: {
            amount: 7500,
            reference: 'withdrawal-ref-123',
            transfer_code: 'TRF_success'
        }
    });

    assert.equal(normalized.success, true);
    assert.equal(normalized.status, 'success');
    assert.equal(normalized.amount, 75);
    assert.equal(normalized.raw_amount, 7500);
    assert.equal(normalized.paystack_amount_subunit, 7500);
    assert.equal(normalized.transaction_reference, 'withdrawal-ref-123');
    assert.equal(normalized.transfer_code, 'TRF_success');

    const reversed = normalizePaystackTransferPayload({
        event: 'transfer.reversed',
        data: {
            amount: 7500,
            reference: 'withdrawal-ref-123',
            transfer_code: 'TRF_reversed'
        }
    });

    assert.equal(reversed.success, false);
    assert.equal(reversed.status, 'failed');
    assert.equal(reversed.paystack_event, 'transfer.reversed');
});
