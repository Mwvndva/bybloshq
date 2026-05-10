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
process.env.PAYSTACK_SECRET_KEY ||= 'integration-secret';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
let runtimePromise;

function read(path) {
    return readFileSync(resolve(root, path), 'utf8');
}

async function runtime() {
    if (!runtimePromise) {
        runtimePromise = Promise.all([
            import('../src/shared/db/database.js'),
            import('../src/core/CorePaymentService.js'),
            import('../src/services/payoutCallbackStateMachine.service.js'),
            import('../src/services/payout.service.js'),
            import('../src/services/fulfillmentQueue.service.js'),
            import('../src/services/orderFulfillmentTransition.service.js'),
            import('../src/services/inventoryReservation.service.js'),
            import('../src/services/logisticsRequest.service.js'),
            import('../src/providers/PaystackProviderClient.js'),
            import('../src/events/eventBus.js')
        ]).then(([
            database,
            corePayment,
            payoutCallbackStateMachine,
            payoutService,
            fulfillmentQueue,
            fulfillmentTransition,
            inventoryReservation,
            logisticsRequest,
            paystackProviderClient,
            eventBusModule
        ]) => ({
            pool: database.pool,
            CorePaymentService: corePayment.default,
            PayoutCallbackStateMachineService: payoutCallbackStateMachine.default,
            payoutService: payoutService.default,
            FulfillmentQueueService: fulfillmentQueue.default,
            OrderFulfillmentTransitionService: fulfillmentTransition.default,
            InventoryReservationService: inventoryReservation.default,
            LogisticsRequestService: logisticsRequest.default,
            PaystackProviderClient: paystackProviderClient.default,
            eventBus: eventBusModule.default
        }));
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

function hmacSignature(payload) {
    const rawBody = JSON.stringify(payload);
    return {
        rawBody,
        signature: crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(Buffer.from(rawBody))
            .digest('hex')
    };
}

function indexOfQuery(client, pattern) {
    return client.queries.findIndex(query => pattern.test(query.normalized));
}

test('payment webhook completes through one atomic transaction and enqueues fulfillment before commit', async () => {
    const {
        pool,
        CorePaymentService,
        eventBus
    } = await runtime();

    const payment = {
        id: 10,
        amount: '100.00',
        status: 'pending',
        provider_reference: 'PAYSTACK-100',
        api_ref: 'PAYSTACK-100',
        invoice_id: null,
        metadata: { order_id: 20 }
    };
    const order = {
        id: 20,
        status: 'CREATED',
        payment_status: 'pending',
        order_type: 'physical'
    };

    const client = new FakeClient([
        respond(text => /FROM payments/.test(text) && /FOR UPDATE/.test(text), [payment]),
        respond(text => /UPDATE payments/.test(text), [{ ...payment, status: 'completed' }]),
        respond(text => /FROM product_orders/.test(text) && /FOR UPDATE/.test(text), [order]),
        respond(text => /UPDATE product_orders/.test(text) && /status = 'PAID'/.test(text), [{ ...order, status: 'PAID', payment_status: 'completed' }]),
        respond(text => /INSERT INTO fulfillment_jobs/.test(text), [{ id: 88, order_id: 20, status: 'PENDING' }])
    ]);
    const dispatched = [];

    const payload = {
        event: 'charge.success',
        data: {
            reference: 'PAYSTACK-100',
            status: 'success',
            amount: 10000,
            receipt_number: 'MPE-100'
        }
    };
    const { rawBody, signature } = hmacSignature(payload);

    await withPatches([
        [pool, 'connect', async () => client],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchAfterCommit', eventId => dispatched.push(eventId)]
    ], async () => {
        const result = await CorePaymentService.handlePaystackWebhook(payload, { signature, rawBody });
        assert.equal(result.status, 'success');
        assert.equal(result.paymentId, 10);
        assert.equal(result.orderId, 20);
    });

    assert.ok(indexOfQuery(client, /^BEGIN$/) < indexOfQuery(client, /UPDATE payments/));
    assert.ok(indexOfQuery(client, /UPDATE payments/) < indexOfQuery(client, /FROM product_orders .* FOR UPDATE/));
    assert.ok(indexOfQuery(client, /FROM product_orders .* FOR UPDATE/) < indexOfQuery(client, /INSERT INTO fulfillment_jobs/));
    assert.ok(indexOfQuery(client, /INSERT INTO fulfillment_jobs/) < indexOfQuery(client, /^COMMIT$/));
    assert.deepEqual(dispatched, ['payment.completed:10']);
    assert.equal(client.released, true);
});

test('Paystack accepted charge returns pending status without completing payment locally', async () => {
    const { PaystackProviderClient } = await runtime();
    const client = new PaystackProviderClient();
    const posts = [];

    await withPatches([
        [client.client, 'post', async (path, payload) => {
            posts.push({ path, payload });
            return {
                data: {
                    status: true,
                    message: 'Charge attempted',
                    data: {
                        reference: payload.reference,
                        status: 'send_otp',
                        amount: payload.amount,
                        currency: 'KES'
                    }
                }
            };
        }]
    ], async () => {
        const result = await client.initiatePayment({
            email: 'buyer@example.com',
            amount: 123.45,
            invoice_id: 'ORDER-123',
            api_ref: 'BYB-ORDER-123',
            phone: '0712345678',
            metadata: { order_id: 123 }
        });

        assert.equal(result.success, true);
        assert.equal(result.reference, 'BYB-ORDER-123');
        assert.equal(result.status, 'pending');
        assert.equal(result.original_response.data.status, 'send_otp');
    });

    assert.equal(posts.length, 1);
    assert.equal(posts[0].path, '/charge');
    assert.deepEqual(posts[0].payload.mobile_money, {
        phone: '+254712345678',
        provider: 'mpesa'
    });
    assert.equal(posts[0].payload.amount, 12345);
    assert.equal(posts[0].payload.metadata.order_id, 123);
});

test('duplicate Paystack charge.success does not duplicate fulfillment', async () => {
    const {
        pool,
        CorePaymentService
    } = await runtime();

    const payment = {
        id: 11,
        amount: '100.00',
        status: 'completed',
        provider_reference: 'PAYSTACK-DUPLICATE',
        api_ref: 'PAYSTACK-DUPLICATE',
        invoice_id: null,
        metadata: { order_id: 21 }
    };

    const client = new FakeClient([
        respond(text => /FROM payments/.test(text) && /FOR UPDATE/.test(text), [payment])
    ]);

    const payload = {
        event: 'charge.success',
        data: {
            reference: 'PAYSTACK-DUPLICATE',
            status: 'success',
            amount: 10000,
            receipt_number: 'MPE-DUP'
        }
    };
    const { rawBody, signature } = hmacSignature(payload);

    await withPatches([
        [pool, 'connect', async () => client]
    ], async () => {
        const result = await CorePaymentService.handlePaystackWebhook(payload, { signature, rawBody });
        assert.equal(result.status, 'already_processed');
        assert.equal(result.payment.id, 11);
    });

    assert.ok(indexOfQuery(client, /^COMMIT$/) > indexOfQuery(client, /FROM payments .* FOR UPDATE/));
    assert.equal(indexOfQuery(client, /FROM product_orders/), -1);
    assert.equal(indexOfQuery(client, /INSERT INTO fulfillment_jobs/), -1);
    assert.equal(client.released, true);
});

test('pending Paystack charge is checked by status polling but not completed', async () => {
    const { PaystackProviderClient } = await runtime();
    const client = new PaystackProviderClient();
    const gets = [];

    await withPatches([
        [client.client, 'get', async path => {
            gets.push(path);
            return {
                data: {
                    status: true,
                    data: {
                        reference: 'PAYSTACK-PENDING',
                        status: 'ongoing',
                        amount: 9900,
                        currency: 'KES'
                    }
                }
            };
        }]
    ], async () => {
        const status = await client.checkTransactionStatus('PAYSTACK-PENDING');
        assert.equal(status.status, 'pending');
        assert.equal(status.reference, 'PAYSTACK-PENDING');
        assert.equal(status.amount, 99);
    });

    assert.deepEqual(gets, ['/transaction/verify/PAYSTACK-PENDING']);
});

test('payment cron race guard claims pending rows with SKIP LOCKED and delegates completion', () => {
    const paymentService = read('src/services/payment.service.js');

    assert.match(paymentService, /WITH claimed AS/);
    assert.match(paymentService, /FOR UPDATE SKIP LOCKED/);
    assert.match(paymentService, /metadata->>'cron_claimed_until'/);
    assert.match(paymentService, /CorePaymentService\.completeVerifiedPayment/);
    assert.match(paymentService, /source:\s*'payment_cron'/);
    assert.doesNotMatch(paymentService, /\?\?\s*payment\.amount/);
    assert.doesNotMatch(paymentService, /\|\|\s*payment\.amount/);
});

test('withdrawal callback race locks request and records late provider success as compensation', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 42,
        seller_id: 7,
        amount: '50.00',
        status: 'failed',
        provider_reference: 'PAYOUT-42',
        idempotency_key: 'WD-42',
        entity_phone: '0712345678'
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /INSERT INTO payout_reconciliation_events/.test(text), [{ id: 5, withdrawal_request_id: 42 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = 'compensation_required'/.test(text), [{ ...request, status: 'compensation_required' }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);
    const dispatched = [];

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async () => {
            throw new Error('refundToWallet must not run for late provider success after refund');
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', eventIds => dispatched.push(...eventIds)]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            transaction_reference: 'PAYOUT-42',
            client_reference: 'WD-42',
            status: 'success',
            result_code: 0,
            amount: '50.00',
            mpesa_receipt: 'RCP-42'
        }, { replayEventId: 'webhook:payout:42' });

        assert.equal(result.status, 'compensation_required');
        assert.equal(result.withdrawalId, 42);
    });

    assert.ok(indexOfQuery(client, /^BEGIN$/) < indexOfQuery(client, /WITH matched_ids AS/));
    assert.match(client.queries[indexOfQuery(client, /WITH matched_ids AS/)].text, /FOR UPDATE OF wr/);
    assert.ok(indexOfQuery(client, /WITH matched_ids AS/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /^COMMIT$/));
    assert.deepEqual(dispatched, [
        'withdrawal.compensation_required:42:PAYOUT-42',
        'withdrawal.updated:42:compensation_required:PAYOUT-42'
    ]);
});

test('fulfillment retry worker claims stale jobs once and finishes through transition service', async () => {
    const {
        pool,
        FulfillmentQueueService,
        OrderFulfillmentTransitionService,
        eventBus
    } = await runtime();

    const job = { id: 90, order_id: 44, status: 'PROCESSING', attempts: 1, max_attempts: 3 };
    const order = { id: 44, status: 'PAID', order_type: 'physical' };
    const claimQueries = [];
    const workerClient = new FakeClient([
        respond(text => /FROM fulfillment_jobs/.test(text) && /FOR UPDATE/.test(text), [job]),
        respond(text => /FROM product_orders/.test(text) && /FOR UPDATE/.test(text), [order]),
        respond(text => /^SELECT \* FROM product_orders/.test(text.replace(/\s+/g, ' ').trim()), [{ ...order, status: 'FULFILLED' }]),
        respond(text => /FROM order_items/.test(text), [{ order_id: 44, product_id: 11, quantity: 1, product_type: 'physical' }]),
        respond(text => /UPDATE fulfillment_jobs SET status = 'COMPLETED'/.test(text), [{ ...job, status: 'COMPLETED' }])
    ]);
    const transitions = [];
    const dispatched = [];

    await withPatches([
        [pool, 'query', async (sql, params = []) => {
            claimQueries.push(String(sql));
            assert.deepEqual(params, [5]);
            assert.match(String(sql), /FOR UPDATE SKIP LOCKED/);
            return { rows: [job], rowCount: 1 };
        }],
        [pool, 'connect', async () => workerClient],
        [OrderFulfillmentTransitionService, 'executeFulfillment', async (client, lockedOrder) => {
            transitions.push({ client, lockedOrder });
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchAfterCommit', eventId => dispatched.push(eventId)]
    ], async () => {
        await FulfillmentQueueService.processJobs(5);
    });

    assert.equal(claimQueries.length, 1);
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].client, workerClient);
    assert.equal(transitions[0].lockedOrder.id, 44);
    assert.ok(indexOfQuery(workerClient, /FROM fulfillment_jobs .* FOR UPDATE/) < indexOfQuery(workerClient, /FROM product_orders .* FOR UPDATE/));
    assert.ok(indexOfQuery(workerClient, /UPDATE fulfillment_jobs SET status = 'COMPLETED'/) < indexOfQuery(workerClient, /^COMMIT$/));
    assert.deepEqual(dispatched, ['order.fulfilled:44']);
});

test('inventory release skips digital products and fails closed on reserved underflow', async () => {
    const { InventoryReservationService } = await runtime();
    const successfulClient = new FakeClient([
        respond(text => /UPDATE products AS p/.test(text) && /reserved_quantity >= v\.qty/.test(text), [{ id: 101, quantity: 8, reserved_quantity: 0 }])
    ]);

    const released = await InventoryReservationService.releaseInventory(successfulClient, [
        { productId: 101, quantity: 2, trackInventory: true, productType: 'physical' },
        { productId: 202, quantity: 1, trackInventory: true, productType: 'digital' }
    ]);

    assert.equal(released, 1);
    assert.deepEqual(successfulClient.queries[0].params, [[101], [2]]);
    assert.match(successfulClient.queries[0].text, /COALESCE\(LOWER\(p\.product_type::text\), ''\) <> 'digital'/);

    const underflowClient = new FakeClient([
        respond(text => /UPDATE products AS p/.test(text), [])
    ]);

    await assert.rejects(
        () => InventoryReservationService.releaseInventory(underflowClient, [
            { productId: 303, quantity: 4, trackInventory: true, productType: 'physical' }
        ]),
        /Reserved inventory invariant failed during release/
    );
});

test('door delivery and seller pickup logistics activate only after completed payment state', () => {
    const paymentEvents = read('src/events/payment.events.js');
    const logisticsService = read('src/services/logisticsRequest.service.js');
    const paymentService = read('src/services/payment.service.js');

    assert.match(paymentEvents, /eventBus\.on\(AppEvents\.PAYMENT\.COMPLETED[\s\S]*activateDoorDeliveryAfterPayment/);
    assert.match(paymentEvents, /eventBus\.on\(AppEvents\.PAYMENT\.COMPLETED[\s\S]*activateSellerPickupAfterPayment/);
    assert.doesNotMatch(paymentEvents, /AppEvents\.PAYMENT\.FAILED[\s\S]*activateDoorDeliveryAfterPayment/);
    assert.doesNotMatch(paymentEvents, /AppEvents\.PAYMENT\.FAILED[\s\S]*activateSellerPickupAfterPayment/);
    assert.match(logisticsService, /COMPLETED_PAYMENT_STATUSES\.has\(String\(lockedPayment\.status \|\| ''\)\.toLowerCase\(\)\)/);
    assert.match(logisticsService, /String\(lockedOrder\.payment_status \|\| ''\)\.toLowerCase\(\) !== 'completed'/);
    assert.match(logisticsService, /return \{ activated: false, reason: 'payment_not_completed' \}/);
    assert.match(paymentService, /LogisticsRequestService\.createDoorDeliveryPaymentPending\(client/);
    assert.match(paymentService, /LogisticsRequestService\.createSellerPickupPaymentPending\(client/);
    assert.match(paymentService, /status:\s*'payment_pending'/);
});

test('Paystack transfer success completes withdrawal without refunding wallet', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 52,
        seller_id: 17,
        amount: '75.00',
        status: 'processing',
        provider_reference: 'TRF-SUCCESS',
        idempotency_key: 'WD-SUCCESS',
        entity_phone: '0712345678'
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = \$1/.test(text), [{ ...request, status: 'completed' }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);
    const dispatched = [];

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async () => {
            throw new Error('refundToWallet must not run on transfer.success');
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', eventIds => dispatched.push(...eventIds)]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            paystack_event: 'transfer.success',
            transaction_reference: 'TRF-SUCCESS',
            client_reference: 'WD-SUCCESS',
            status: 'success',
            amount: '75.00',
            mpesa_receipt: 'MPE-SUCCESS'
        }, { replayEventId: 'paystack:transfer.success:TRF-SUCCESS' });

        assert.equal(result.status, 'completed');
        assert.equal(result.withdrawalId, 52);
    });

    assert.equal(indexOfQuery(client, /SELECT id FROM sellers/), -1);
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /^COMMIT$/));
    assert.deepEqual(dispatched, [
        'withdrawal.updated:52:completed',
        'withdrawal.completed:52:TRF-SUCCESS'
    ]);
});

test('Paystack transfer failure refunds seller wallet once', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 53,
        seller_id: 18,
        amount: '80.00',
        status: 'processing',
        provider_reference: 'TRF-FAILED',
        idempotency_key: 'WD-FAILED',
        entity_phone: '0712345678'
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /SELECT id FROM sellers WHERE id = \$1 FOR UPDATE/.test(text), [{ id: 18 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = \$1/.test(text), [{ ...request, status: 'failed' }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);
    const refunds = [];

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async (_client, refundedRequest) => {
            refunds.push(refundedRequest.id);
            return 980;
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', () => {}]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            paystack_event: 'transfer.failed',
            transaction_reference: 'TRF-FAILED',
            client_reference: 'WD-FAILED',
            status: 'failed',
            amount: '80.00'
        }, { replayEventId: 'paystack:transfer.failed:TRF-FAILED' });

        assert.equal(result.status, 'failed');
        assert.equal(result.withdrawalId, 53);
    });

    assert.deepEqual(refunds, [53]);
    assert.ok(indexOfQuery(client, /SELECT id FROM sellers/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /^COMMIT$/));
});

test('Paystack transfer reversal after completion requires compensation without wallet mutation', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 54,
        seller_id: 19,
        amount: '95.00',
        status: 'completed',
        provider_reference: 'TRF-REVERSED',
        idempotency_key: 'WD-REVERSED',
        entity_phone: '0712345678'
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /INSERT INTO payout_reconciliation_events/.test(text), [{ id: 501, withdrawal_request_id: 54 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = 'compensation_required'/.test(text), [{ ...request, status: 'compensation_required' }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async () => {
            throw new Error('refundToWallet must not run on transfer.reversed after completion');
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', () => {}]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            paystack_event: 'transfer.reversed',
            transaction_reference: 'TRF-REVERSED',
            client_reference: 'WD-REVERSED',
            status: 'failed',
            amount: '95.00'
        }, { replayEventId: 'paystack:transfer.reversed:TRF-REVERSED' });

        assert.equal(result.status, 'compensation_required');
        assert.equal(result.withdrawalId, 54);
    });

    assert.equal(indexOfQuery(client, /SELECT id FROM sellers/), -1);
    assert.ok(indexOfQuery(client, /INSERT INTO payout_reconciliation_events/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /^COMMIT$/));
});
