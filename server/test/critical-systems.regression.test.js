import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_HOST ||= 'localhost';
process.env.DB_NAME ||= 'byblos_test';
process.env.DB_USER ||= 'byblos_test';
process.env.DB_PASSWORD ||= 'byblos_test';
process.env.PAYD_USERNAME ||= 'payd_user';
process.env.PAYD_PASSWORD ||= 'payd_pass';
process.env.PAYD_WEBHOOK_SECRET ||= 'critical-regression-secret';
process.env.PAYD_CALLBACK_SECRET ||= 'critical-regression-secret';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function read(path) {
    return readFileSync(resolve(root, path), 'utf8');
}

let runtimePromise;

async function runtime() {
    if (!runtimePromise) {
        const originalSetInterval = globalThis.setInterval;
        globalThis.setInterval = (...args) => {
            const handle = originalSetInterval(...args);
            if (handle && typeof handle.unref === 'function') handle.unref();
            return handle;
        };

        runtimePromise = Promise.all([
            import('../src/shared/db/database.js'),
            import('../src/core/CorePaymentService.js'),
            import('../src/middleware/paydWebhookSecurity.js'),
            import('../src/services/EscrowManager.js'),
            import('../src/services/authorization.service.js'),
            import('../src/shared/utils/OrderStatusGuard.js'),
            import('../src/shared/constants/enums.js'),
            import('../src/validations/order.validation.js')
        ]).then(([
            database,
            corePayment,
            webhookSecurity,
            escrowManager,
            authorizationService,
            orderStatusGuard,
            enums,
            orderValidation
        ]) => ({
            pool: database.pool,
            CorePaymentService: corePayment.default,
            requirePaydWebhookHmac: webhookSecurity.requirePaydWebhookHmac,
            EscrowManager: escrowManager.default,
            AuthorizationService: authorizationService.default,
            assertValidTransition: orderStatusGuard.assertValidTransition,
            OrderStatus: enums.OrderStatus,
            updateOrderStatusSchema: orderValidation.updateOrderStatusSchema
        })).finally(() => {
            globalThis.setInterval = originalSetInterval;
        });
    }

    return runtimePromise;
}

class FakeClient {
    constructor(handlers = []) {
        this.handlers = handlers;
        this.queries = [];
        this.released = false;
    }

    async query(sql, params = []) {
        const text = String(sql);
        const normalized = text.replace(/\s+/g, ' ').trim();
        this.queries.push({ text, normalized, params });

        if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(normalized)) {
            return { rows: [], rowCount: 0 };
        }

        const handler = this.handlers.find(entry => entry.match(text, params, normalized));
        if (!handler) {
            throw new Error(`Unexpected test query: ${normalized}`);
        }

        return handler.run(text, params, normalized);
    }

    release() {
        this.released = true;
    }
}

function respond(match, rows = []) {
    return {
        match,
        run: () => ({ rows, rowCount: rows.length })
    };
}

function patchMethod(target, key, replacement) {
    const original = target[key];
    target[key] = replacement;
    return () => {
        target[key] = original;
    };
}

async function withPatches(patches, fn) {
    const restore = [];
    try {
        for (const [target, key, replacement] of patches) {
            restore.push(patchMethod(target, key, replacement));
        }
        return await fn();
    } finally {
        for (const restoreOne of restore.reverse()) {
            restoreOne();
        }
    }
}

function indexOfQuery(client, pattern) {
    return client.queries.findIndex(query => pattern.test(query.normalized));
}

function signedWebhook(payload, headers = {}) {
    const rawBody = JSON.stringify(payload);
    const signature = crypto
        .createHmac('sha256', process.env.PAYD_WEBHOOK_SECRET)
        .update(Buffer.from(rawBody))
        .digest('hex');
    return {
        rawBody,
        headers: {
            'x-payd-signature': signature,
            'x-payd-timestamp': String(Date.now()),
            'x-payd-event-id': 'evt-critical-regression',
            ...headers
        }
    };
}

function createMockRes() {
    const listeners = {};
    return {
        statusCode: 200,
        body: null,
        listeners,
        on(event, handler) {
            listeners[event] = handler;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        finish() {
            if (listeners.finish) listeners.finish();
        }
    };
}

test('payment lifecycle rejects provider success without amount and persists fraud evidence after rollback', async () => {
    const { pool, CorePaymentService } = await runtime();
    const payment = {
        id: 501,
        amount: '120.00',
        status: 'pending',
        provider_reference: 'PAYD-MISSING-AMOUNT',
        api_ref: 'PAYD-MISSING-AMOUNT',
        invoice_id: null,
        metadata: { order_id: 701 }
    };
    const client = new FakeClient([
        respond(text => /SELECT \* FROM payments WHERE id = \$1 FOR UPDATE/.test(text), [payment])
    ]);
    const fraudEvents = [];

    await withPatches([
        [pool, 'connect', async () => client],
        [pool, 'query', async (sql, params = []) => {
            fraudEvents.push({ sql: String(sql), params });
            return { rows: [], rowCount: 1 };
        }]
    ], async () => {
        await assert.rejects(
            () => CorePaymentService.completeVerifiedPayment({
                paymentId: payment.id,
                reference: payment.provider_reference,
                providerPayload: {
                    api_ref: payment.api_ref,
                    status: 'success',
                    result_code: 0
                },
                source: 'critical_regression'
            }),
            /missing valid amount/
        );
    });

    assert.ok(indexOfQuery(client, /^BEGIN$/) > -1);
    assert.ok(indexOfQuery(client, /^ROLLBACK$/) > indexOfQuery(client, /SELECT \* FROM payments/));
    assert.equal(indexOfQuery(client, /UPDATE payments/), -1);
    assert.equal(indexOfQuery(client, /INSERT INTO fulfillment_jobs/), -1);
    assert.equal(client.released, true);
    assert.equal(fraudEvents.length, 1);
    assert.match(fraudEvents[0].sql, /INSERT INTO fraud_events/);
    assert.equal(fraudEvents[0].params[0], payment.id);
    assert.equal(fraudEvents[0].params[1], 701);
    assert.equal(fraudEvents[0].params[3], 'missing_or_invalid_success_amount');
});

test('webhook retry protection claims first delivery and suppresses completed replay', async () => {
    const { pool, requirePaydWebhookHmac } = await runtime();
    const payload = {
        api_ref: 'PAYD-REPLAY-1',
        amount: '100.00',
        status: 'success',
        result_code: 0
    };
    const signed = signedWebhook(payload);
    const queries = [];

    await withPatches([
        [pool, 'query', async (sql, params = []) => {
            queries.push({ sql: String(sql), params });
            if (/WITH upsert AS/.test(String(sql))) {
                return { rows: [{ status: 'processing', attempts: 1, claimed: true }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }]
    ], async () => {
        const req = {
            body: payload,
            rawBody: signed.rawBody,
            headers: signed.headers,
            ip: '127.0.0.1',
            originalUrl: '/api/payments/webhook/payd'
        };
        const res = createMockRes();
        let nextCalled = false;

        await requirePaydWebhookHmac(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.webhookSecurity.hmacVerified, true);
        assert.equal(req.webhookSecurity.replayEventId, 'evt-critical-regression');
        res.finish();
        await Promise.resolve();
    });

    assert.match(queries[0].sql, /webhook_replay_dedupe/);
    assert.equal(queries[0].params[0], 'evt-critical-regression');
    assert.match(queries.some(query => /SET status = \$2/.test(query.sql)) ? 'SET status = $2' : '', /SET status = \$2/);

    await withPatches([
        [pool, 'query', async (sql, params = []) => {
            queries.push({ sql: String(sql), params });
            if (/WITH upsert AS/.test(String(sql))) {
                return { rows: [{ status: 'completed', attempts: 2, claimed: false }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        }]
    ], async () => {
        const req = {
            body: payload,
            rawBody: signed.rawBody,
            headers: signed.headers,
            ip: '127.0.0.1',
            originalUrl: '/api/payments/webhook/payd'
        };
        const res = createMockRes();
        let nextCalled = false;

        await requirePaydWebhookHmac(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.message, 'Webhook already processed');
    });
});

test('escrow release credits seller exactly once behind payout idempotency gate', async () => {
    const { EscrowManager } = await runtime();
    const order = {
        id: 801,
        order_number: 'BYB-801',
        seller_id: 77,
        seller_payout_amount: '99.00',
        platform_fee_amount: '1.00',
        total_amount: '100.00'
    };
    const client = new FakeClient([
        respond(text => /SELECT id FROM payments/.test(text), [{ id: 601 }]),
        respond(text => /FROM logistics_requests lr/.test(text), []),
        respond(text => /INSERT INTO payouts/.test(text) && /ON CONFLICT \(order_id\) DO NOTHING/.test(text), [{ id: 901 }]),
        respond(text => /UPDATE sellers/.test(text), []),
        respond(text => /UPDATE product_orders/.test(text), [])
    ]);

    const result = await EscrowManager.releaseFunds(client, order, 'critical-test');

    assert.deepEqual(result, { success: true, alreadyReleased: false });
    assert.ok(indexOfQuery(client, /INSERT INTO payouts/) < indexOfQuery(client, /UPDATE sellers/));
    assert.ok(indexOfQuery(client, /UPDATE sellers/) < indexOfQuery(client, /UPDATE product_orders/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE sellers/)].params, [99, 100, 77]);

    const duplicateClient = new FakeClient([
        respond(text => /SELECT id FROM payments/.test(text), [{ id: 601 }]),
        respond(text => /FROM logistics_requests lr/.test(text), []),
        respond(text => /INSERT INTO payouts/.test(text), [])
    ]);

    const duplicate = await EscrowManager.releaseFunds(duplicateClient, order, 'critical-test');

    assert.deepEqual(duplicate, { success: true, alreadyReleased: true });
    assert.equal(indexOfQuery(duplicateClient, /UPDATE sellers/), -1);
});

test('escrow release is held when delivery logistics failed or needs admin review', async () => {
    const { EscrowManager } = await runtime();
    const order = {
        id: 802,
        order_number: 'BYB-802',
        seller_id: 77,
        seller_payout_amount: '99.00',
        platform_fee_amount: '1.00',
        total_amount: '100.00'
    };
    const client = new FakeClient([
        respond(text => /SELECT id FROM payments/.test(text), [{ id: 602 }]),
        respond(text => /FROM logistics_requests lr/.test(text), [{
            request_status: 'failed',
            has_failed_leg: true
        }])
    ]);

    const result = await EscrowManager.releaseFunds(client, order, 'critical-test');

    assert.deepEqual(result, { success: false, reason: 'logistics_delivery_hold' });
    assert.equal(indexOfQuery(client, /INSERT INTO payouts/), -1);
    assert.equal(indexOfQuery(client, /UPDATE sellers/), -1);
});

test('role permissions preserve admin authority and scoped buyer/seller fallbacks', async () => {
    const { AuthorizationService } = await runtime();

    assert.equal(await AuthorizationService.hasPermission({ role: 'admin', id: 1 }, 'manage-all'), true);
    assert.equal(await AuthorizationService.hasPermission({ userType: 'seller', id: 2, permissions: new Set() }, 'request-payouts'), true);
    assert.equal(await AuthorizationService.hasPermission({ userType: 'seller', id: 2, permissions: new Set() }, 'manage-all'), false);
    assert.equal(await AuthorizationService.hasPermission({ userType: 'buyer', id: 3, permissions: new Set() }, 'manage-profile'), true);
    assert.equal(await AuthorizationService.hasPermission({ userType: 'buyer', id: 3, permissions: new Set() }, 'request-payouts'), false);
});

test('order state machine allows idempotent/valid transitions and rejects terminal rewinds', async () => {
    const { assertValidTransition, OrderStatus } = await runtime();

    assert.equal(assertValidTransition(OrderStatus.PAID, OrderStatus.PAID, 'order-1'), true);
    assert.equal(assertValidTransition(OrderStatus.PAID, OrderStatus.FULFILLMENT_PENDING, 'order-1'), true);
    assert.equal(assertValidTransition(OrderStatus.FULFILLMENT_PENDING, OrderStatus.FULFILLED, 'order-1'), true);

    assert.throws(
        () => assertValidTransition(OrderStatus.COMPLETED, OrderStatus.PAID, 'order-1'),
        /Illegal state transition/
    );
});

test('API validation guards retired order creation, location preview, and status payloads', async () => {
    const { updateOrderStatusSchema } = await runtime();
    const orderController = read('src/controllers/order.controller.js');
    const paymentController = read('src/controllers/payment.controller.js');

    assert.equal(updateOrderStatusSchema.safeParse({ status: 'processing' }).success, true);
    assert.equal(updateOrderStatusSchema.safeParse({ status: 'PAID' }).success, false);
    assert.equal(updateOrderStatusSchema.safeParse({ status: 'completed' }).success, false);
    assert.match(orderController, /status\(410\)\.json/);
    assert.match(orderController, /DIRECT_ORDER_CREATION_RETIRED/);
    assert.match(orderController, /Direct order creation is retired/);
    assert.match(orderController, /Latitude and longitude are required for location preview/);
    assert.match(orderController, /https:\/\/www\.google\.com\/maps\?q=\$\{latitude\},\$\{longitude\}/);
    assert.match(paymentController, /Checkout idempotency token is required/);
    assert.match(paymentController, /req\.headers\['idempotency-key'\]/);
    assert.match(paymentController, /req\.headers\['x-checkout-token'\]/);
});
