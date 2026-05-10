import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.DB_HOST ||= 'localhost';
process.env.DB_NAME ||= 'byblos_test';
process.env.DB_USER ||= 'byblos_test';
process.env.DB_PASSWORD ||= 'byblos_test';

let middlewarePromise;

async function middleware() {
    middlewarePromise ||= import('../src/middleware/paystackWebhookSecurity.js');
    return middlewarePromise;
}

test('Paystack webhook HMAC uses SHA512 over the raw request body', async () => {
    const { verifyPaystackHmacSignature } = await middleware();
    const secret = 'paystack-webhook-secret';
    const rawBody = Buffer.from(JSON.stringify({
        event: 'charge.success',
        data: { reference: 'BYB-123', status: 'success', paid_at: '2026-05-10T12:00:00Z' }
    }));
    const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    assert.equal(verifyPaystackHmacSignature(signature, rawBody, secret), true);
    assert.equal(verifyPaystackHmacSignature(signature, Buffer.from('{}'), secret), false);
    assert.equal(verifyPaystackHmacSignature('not-a-hex-signature', rawBody, secret), false);
});

test('Paystack replay event id derives from event, reference, status, and timestamp when no stable id exists', async () => {
    const { derivePaystackReplayEventId } = await middleware();
    const eventId = derivePaystackReplayEventId({
        eventType: 'charge.success',
        root: {
            event: 'charge.success',
            data: {
                reference: 'BYB-ORDER-123',
                status: 'success',
                paid_at: '2026-05-10T12:00:00Z'
            }
        },
        data: {
            reference: 'BYB-ORDER-123',
            status: 'success',
            paid_at: '2026-05-10T12:00:00Z'
        }
    });

    assert.equal(eventId, 'paystack:charge.success:BYB-ORDER-123:success:2026-05-10T12:00:00Z');
});

test('Paystack replay event id prefers stable payload ids and caps oversized ids', async () => {
    const { derivePaystackReplayEventId } = await middleware();
    const stable = derivePaystackReplayEventId({
        eventType: 'transfer.success',
        root: { event: 'transfer.success', data: { id: 123456, reference: 'withdrawal-ref' } },
        data: { id: 123456, reference: 'withdrawal-ref' }
    });
    assert.equal(stable, 'paystack:transfer.success:123456');

    const oversized = derivePaystackReplayEventId({
        eventType: 'charge.success',
        root: {
            event: 'charge.success',
            data: {
                reference: 'R'.repeat(260),
                status: 'success',
                updatedAt: '2026-05-10T12:00:00Z'
            }
        },
        data: {
            reference: 'R'.repeat(260),
            status: 'success',
            updatedAt: '2026-05-10T12:00:00Z'
        }
    });

    assert.equal(oversized.length, 255);
    assert.match(oversized, /^paystack:charge\.success:R+/);
});
