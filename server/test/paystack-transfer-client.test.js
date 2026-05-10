import test from 'node:test';
import assert from 'node:assert/strict';
import PaystackTransferClient from '../src/providers/PaystackTransferClient.js';

test('PaystackTransferClient normalizes Kenyan M-Pesa transfer numbers to local format', () => {
    const client = new PaystackTransferClient();

    assert.equal(client.normalizePhoneForTransfer('+254712345678'), '0712345678');
    assert.equal(client.normalizePhoneForTransfer('712345678'), '0712345678');
    assert.equal(client.normalizePhoneForTransfer('0712345678'), '0712345678');
    assert.throws(() => client.normalizePhoneForTransfer('0201234567'), /Invalid Kenyan phone number/);
});

test('PaystackTransferClient creates KES M-Pesa transfer recipients only', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
    const client = new PaystackTransferClient();
    const calls = [];

    client.client = {
        post: async (path, payload) => {
            calls.push({ path, payload });
            return { data: { status: true, data: { recipient_code: 'RCP_test' } } };
        }
    };

    const recipient = await client.createTransferRecipient({
        name: 'Seller Name',
        phoneNumber: '+254712345678',
        currency: 'KES'
    });

    assert.equal(recipient.recipient_code, 'RCP_test');
    assert.deepEqual(calls[0], {
        path: '/transferrecipient',
        payload: {
            type: 'mobile_money',
            name: 'Seller Name',
            account_number: '0712345678',
            bank_code: 'MPESA',
            currency: 'KES'
        }
    });

    await assert.rejects(
        () => client.createTransferRecipient({ name: 'Seller Name', phoneNumber: '0712345678', currency: 'USD' }),
        /Only KES M-Pesa wallet transfer recipients are supported/
    );
});

test('PaystackTransferClient initiates transfers with provider-owned amount conversion', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
    const client = new PaystackTransferClient();
    const calls = [];

    client.client = {
        post: async (path, payload) => {
            calls.push({ path, payload });
            if (path === '/transferrecipient') {
                return { data: { status: true, data: { recipient_code: 'RCP_test' } } };
            }
            return {
                data: {
                    status: true,
                    data: {
                        status: 'pending',
                        amount: payload.amount,
                        reference: payload.reference,
                        transfer_code: 'TRF_test'
                    }
                }
            };
        }
    };

    const result = await client.initiateTransfer({
        amount: 50.25,
        phoneNumber: '0712345678',
        name: 'Seller Name',
        narration: 'Byblos seller withdrawal',
        reference: 'Withdrawal Request #1234567890'
    });

    const transferCall = calls.find(call => call.path === '/transfer');
    assert.equal(transferCall.payload.source, 'balance');
    assert.equal(transferCall.payload.amount, 5025);
    assert.equal(transferCall.payload.currency, 'KES');
    assert.match(transferCall.payload.reference, /^[a-z0-9_-]{16,50}$/);
    assert.equal(result.amount, 50.25);
    assert.equal(result.transfer_code, 'TRF_test');
});

test('PaystackTransferClient normalizes Paystack transfer callback payloads', () => {
    const client = new PaystackTransferClient();
    const normalized = client.normalizePaystackTransferPayload({
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
    assert.equal(normalized.transaction_reference, 'withdrawal-ref-123');
    assert.equal(normalized.client_reference, 'withdrawal-ref-123');
    assert.equal(normalized.mpesa_receipt, 'TRF_success');
});
