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
            import('../src/events/eventBus.js'),
            import('../src/services/EscrowManager.js'),
            import('../src/services/creator.service.js'),
            import('../src/services/settlement.service.js'),
            import('../src/services/withdrawal.service.js')
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
            eventBusModule,
            escrowManager,
            creatorService,
            settlementService,
            withdrawalService
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
            eventBus: eventBusModule.default,
            EscrowManager: escrowManager.default,
            CreatorService: creatorService.default,
            settlementService: settlementService.default,
            WithdrawalService: withdrawalService.default
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

test('completed order creates pending settlement instead of withdrawable seller balance', async () => {
    const {
        EscrowManager,
        CreatorService
    } = await runtime();

    const order = {
        id: 900,
        order_number: 'BYB-900',
        status: 'COMPLETED',
        seller_id: 77,
        seller_payout_amount: '490.00',
        total_amount: '500.00'
    };
    const client = new FakeClient([
        respond(text => /SELECT id FROM payments/.test(text), [{ id: 333 }]),
        respond(text => /FROM logistics_requests/.test(text), []),
        respond(text => /INSERT INTO payouts/.test(text), [{ id: 444 }]),
        respond(text => /UPDATE sellers/.test(text) && /pending_settlement_balance/.test(text), [{
            balance: '0.00',
            pending_settlement_balance: '490.00',
            net_revenue: '490.00',
            total_sales: '500.00'
        }]),
        respond(text => /UPDATE product_orders/.test(text), [])
    ]);

    await withPatches([
        [CreatorService, 'creditCreatorForOrder', async () => {}],
        [CreatorService, 'creditCreatorReferralForSeller', async () => {}]
    ], async () => {
        const result = await EscrowManager.releaseFunds(client, order, 'test');
        assert.equal(result.success, true);
        assert.equal(result.alreadyReleased, false);
        assert.ok(result.availableAt instanceof Date);
    });

    const insert = client.queries.find(query => /INSERT INTO payouts/.test(query.text));
    const sellerUpdate = client.queries.find(query => /UPDATE sellers/.test(query.text));
    assert.match(insert.text, /'pending'/);
    assert.match(insert.text, /'pending_settlement'/);
    assert.match(sellerUpdate.text, /pending_settlement_balance = COALESCE\(pending_settlement_balance, 0\) \+ \$1/);
    assert.doesNotMatch(sellerUpdate.text, /balance\s*=\s*COALESCE\(balance, 0\)\s*\+\s*\$1/);
});

test('settlement promotion moves eligible pending funds into available balance', async () => {
    const { settlementService } = await runtime();
    const client = new FakeClient([
        respond(text => /FROM payouts/.test(text) && /FOR UPDATE SKIP LOCKED/.test(text), [{
            id: 444,
            seller_id: 77,
            amount: '490.00'
        }]),
        respond(text => /UPDATE sellers/.test(text) && /pending_settlement_balance/.test(text), [{ id: 77 }]),
        respond(text => /UPDATE payouts/.test(text) && /settlement_status = 'settled'/.test(text), [{ id: 444 }])
    ]);

    const result = await settlementService.promoteEligibleSettlements(client, { limit: 10 });

    assert.deepEqual(result, { scanned: 1, promoted: 1 });
    assert.ok(indexOfQuery(client, /FROM payouts .* FOR UPDATE SKIP LOCKED/) < indexOfQuery(client, /UPDATE sellers/));
    assert.ok(indexOfQuery(client, /UPDATE sellers/) < indexOfQuery(client, /UPDATE payouts/));
    const sellerUpdate = client.queries[indexOfQuery(client, /UPDATE sellers/)];
    const payoutUpdate = client.queries[indexOfQuery(client, /UPDATE payouts/)];
    assert.match(
        sellerUpdate.text,
        /pending_settlement_balance = GREATEST\(COALESCE\(pending_settlement_balance, 0\) - \$1, 0\)/
    );
    assert.match(sellerUpdate.text, /balance = COALESCE\(balance, 0\) \+ \$1/);
    assert.match(payoutUpdate.text, /status = 'completed'/);
    assert.match(payoutUpdate.text, /settlement_status = 'settled'/);
    assert.deepEqual(sellerUpdate.params, [490, 77]);
    assert.deepEqual(payoutUpdate.params, [444, JSON.stringify({ promoted_by: 'settlement_service' })]);
});

test('withdrawal before settlement fails with insufficient available balance copy', async () => {
    const {
        pool,
        WithdrawalService
    } = await runtime();

    const client = new FakeClient([
        respond(text => /FROM sellers/.test(text) && /FOR UPDATE/.test(text), [{
            id: 77,
            balance: '0.00',
            pending_settlement_balance: '490.00',
            withdrawal_reserved_balance: '0.00',
            full_name: 'Seller',
            whatsapp_number: '0712345678'
        }]),
        respond(text => /FROM withdrawal_requests/.test(text) && /FOR UPDATE/.test(text), [])
    ]);

    await withPatches([
        [pool, 'connect', async () => client]
    ], async () => {
        await assert.rejects(
            () => WithdrawalService.createWithdrawalRequest({
                entityId: 77,
                entityType: 'seller',
                amount: 100,
                mpesaNumber: '0712345678',
                mpesaName: 'Seller',
                idempotencyKey: 'WD-PENDING-SETTLEMENT'
            }),
            /Recent sales may still be pending Paystack settlement/
        );
    });

    assert.equal(indexOfQuery(client, /UPDATE sellers/), -1);
    assert.ok(indexOfQuery(client, /^ROLLBACK$/) > indexOfQuery(client, /FROM withdrawal_requests/));
});

test('refund before settlement consumes pending payout before it can mature', async () => {
    const { settlementService } = await runtime();
    const client = new FakeClient([
        respond(text => /FROM payouts/.test(text) && /FOR UPDATE/.test(text), [{
            id: 444,
            seller_id: 77,
            amount: '490.00',
            settlement_status: 'pending_settlement',
            status: 'pending'
        }]),
        respond(text => /UPDATE sellers/.test(text) && /refund_reserved_balance/.test(text), [{ id: 77 }]),
        respond(text => /UPDATE payouts/.test(text) && /refunded_before_settlement/.test(text), [{ id: 444 }])
    ]);

    const result = await settlementService.reverseOrderSettlementForRefund(client, 900, 'test_refund');

    assert.equal(result.adjusted, true);
    assert.equal(result.bucket, 'pending_settlement');
    assert.equal(result.amount, 490);
    assert.ok(indexOfQuery(client, /UPDATE sellers/) < indexOfQuery(client, /UPDATE payouts/));
    const sellerUpdate = client.queries[indexOfQuery(client, /UPDATE sellers/)];
    const payoutUpdate = client.queries[indexOfQuery(client, /UPDATE payouts/)];
    assert.match(
        sellerUpdate.text,
        /pending_settlement_balance = GREATEST\(COALESCE\(pending_settlement_balance, 0\) - \$1, 0\)/
    );
    assert.match(sellerUpdate.text, /refund_reserved_balance = COALESCE\(refund_reserved_balance, 0\) \+ \$1/);
    assert.match(payoutUpdate.text, /status = 'refunded'/);
    assert.match(payoutUpdate.text, /settlement_status = 'refunded_before_settlement'/);
    assert.deepEqual(sellerUpdate.params, [490, 77]);
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
        entity_phone: '0712345678',
        metadata: {
            withdrawal_fee: 10,
            total_deducted: 85
        }
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /SELECT id FROM sellers WHERE id = \$1 FOR UPDATE/.test(text), [{ id: 17 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = \$1/.test(text), [{ ...request, status: 'completed' }]),
        respond(text => /UPDATE sellers/.test(text) && /withdrawal_reserved_balance/.test(text), [{ id: 17 }]),
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

    assert.ok(indexOfQuery(client, /SELECT id FROM sellers/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /UPDATE sellers/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE sellers/)].params, [85, 17]);
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /^COMMIT$/));
    assert.deepEqual(dispatched, [
        'withdrawal.updated:52:completed',
        'withdrawal.completed:52:TRF-SUCCESS'
    ]);
});

test('creator withdrawal creation reserves balance in shared withdrawal_requests', async () => {
    const {
        pool,
        WithdrawalService,
        eventBus
    } = await runtime();

    const creator = {
        id: 44,
        balance: '500.00',
        withdrawal_reserved_balance: '0.00',
        full_name: 'Amani Creator',
        mpesa_number: '0712345678',
        whatsapp_number: '0712345678',
        entity_type: 'creator'
    };
    const request = {
        id: 144,
        seller_id: null,
        creator_id: 44,
        amount: '100.00',
        mpesa_number: '254712345678',
        mpesa_name: 'Amani Creator',
        status: 'processing',
        idempotency_key: 'CREATOR-WD-1',
        metadata: { withdrawal_fee: 21, total_deducted: 121, entity_type: 'creator' },
        created_at: new Date()
    };
    const client = new FakeClient([
        respond(text => /FROM creators/.test(text) && /FOR UPDATE/.test(text), [creator]),
        respond(text => /FROM withdrawal_requests/.test(text) && /creator_id = \$1/.test(text), []),
        respond(text => /UPDATE creators/.test(text) && /withdrawal_reserved_balance = COALESCE/.test(text), []),
        respond(text => /INSERT INTO withdrawal_requests/.test(text) && /seller_id, creator_id/.test(text), [request])
    ]);
    const dispatched = [];

    await withPatches([
        [pool, 'connect', async () => client],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchAfterCommit', eventId => dispatched.push(eventId)],
        [WithdrawalService, '_callProviderAndUpdate', async () => {}]
    ], async () => {
        const result = await WithdrawalService.createWithdrawalRequest({
            entityId: 44,
            entityType: 'creator',
            amount: 100,
            idempotencyKey: 'CREATOR-WD-1'
        });

        assert.equal(result.creator_id, 44);
        assert.equal(result.seller_id, null);
    });

    assert.ok(indexOfQuery(client, /SELECT id, balance, withdrawal_reserved_balance/) < indexOfQuery(client, /UPDATE creators/));
    assert.ok(indexOfQuery(client, /UPDATE creators/) < indexOfQuery(client, /INSERT INTO withdrawal_requests/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE creators/)].params, [121, 44]);
    assert.deepEqual(client.queries[indexOfQuery(client, /INSERT INTO withdrawal_requests/)].params.slice(0, 7), [
        null,
        44,
        null,
        100,
        '0712345678',
        'Amani Creator',
        'CREATOR-WD-1'
    ]);
    assert.equal(
        client.queries[indexOfQuery(client, /INSERT INTO withdrawal_requests/)].params[7],
        JSON.stringify({ withdrawal_fee: 21, total_deducted: 121, entity_type: 'creator' })
    );
    assert.deepEqual(dispatched, ['withdrawal.created:144']);
});

test('Paystack transfer success releases creator withdrawal reserve', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 145,
        seller_id: null,
        creator_id: 44,
        amount: '100.00',
        status: 'processing',
        provider_reference: 'TRF-CREATOR-SUCCESS',
        idempotency_key: 'CREATOR-WD-2',
        entity_phone: '0712345678',
        metadata: {
            withdrawal_fee: 21,
            total_deducted: 121
        }
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /SELECT id FROM creators WHERE id = \$1 FOR UPDATE/.test(text), [{ id: 44 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = \$1/.test(text), [{ ...request, status: 'completed' }]),
        respond(text => /UPDATE creators/.test(text) && /withdrawal_reserved_balance/.test(text), [{ id: 44 }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async () => {
            throw new Error('refundToWallet must not run on transfer.success');
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', () => {}]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            paystack_event: 'transfer.success',
            transaction_reference: 'TRF-CREATOR-SUCCESS',
            client_reference: 'CREATOR-WD-2',
            status: 'success',
            amount: '100.00',
            mpesa_receipt: 'MPE-CREATOR'
        }, { replayEventId: 'paystack:transfer.success:TRF-CREATOR-SUCCESS' });

        assert.equal(result.status, 'completed');
        assert.equal(result.withdrawalId, 145);
    });

    assert.ok(indexOfQuery(client, /SELECT id FROM creators/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /UPDATE creators/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE creators/)].params, [121, 44]);
});

test('buyer refund withdrawal reserves refunds plus withdrawal fee in shared withdrawal_requests', async () => {
    const {
        pool,
        WithdrawalService,
        eventBus
    } = await runtime();

    const buyer = {
        id: 61,
        balance: '500.00',
        withdrawal_reserved_balance: '0.00',
        full_name: 'Nairobi Buyer',
        mobile_payment: '0711111111',
        whatsapp_number: '0711111111',
        mpesa_number: null,
        entity_type: 'buyer_refund'
    };
    const request = {
        id: 161,
        seller_id: null,
        creator_id: null,
        buyer_id: 61,
        amount: '100.00',
        mpesa_number: '0711111111',
        mpesa_name: 'Nairobi Buyer',
        status: 'processing',
        idempotency_key: 'BUYER-REFUND-WD-1',
        metadata: { withdrawal_fee: 21, total_deducted: 121, entity_type: 'buyer_refund', source: 'buyer_refund_withdrawal' },
        created_at: new Date()
    };
    const client = new FakeClient([
        respond(text => /FROM buyers/.test(text) && /refunds AS balance/.test(text) && /FOR UPDATE/.test(text), [buyer]),
        respond(text => /FROM withdrawal_requests/.test(text) && /buyer_id = \$1/.test(text), []),
        respond(text => /UPDATE buyers/.test(text) && /refund_withdrawal_reserved_balance = COALESCE/.test(text), []),
        respond(text => /INSERT INTO withdrawal_requests/.test(text) && /seller_id, creator_id, buyer_id/.test(text), [request])
    ]);

    await withPatches([
        [pool, 'connect', async () => client],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchAfterCommit', () => {}],
        [WithdrawalService, '_callProviderAndUpdate', async () => {}]
    ], async () => {
        const result = await WithdrawalService.createWithdrawalRequest({
            entityId: 61,
            entityType: 'buyer_refund',
            amount: 100,
            idempotencyKey: 'BUYER-REFUND-WD-1'
        });

        assert.equal(result.buyer_id, 61);
        assert.equal(result.seller_id, null);
        assert.equal(result.creator_id, null);
    });

    assert.ok(indexOfQuery(client, /SELECT id,\s+refunds AS balance/) < indexOfQuery(client, /UPDATE buyers/));
    assert.ok(indexOfQuery(client, /UPDATE buyers/) < indexOfQuery(client, /INSERT INTO withdrawal_requests/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE buyers/)].params, [121, 61]);
    assert.deepEqual(client.queries[indexOfQuery(client, /INSERT INTO withdrawal_requests/)].params.slice(0, 8), [
        null,
        null,
        61,
        100,
        '0711111111',
        'Nairobi Buyer',
        'BUYER-REFUND-WD-1',
        JSON.stringify({ withdrawal_fee: 21, total_deducted: 121, entity_type: 'buyer_refund', source: 'buyer_refund_withdrawal' })
    ]);
});

test('Paystack transfer success releases buyer refund withdrawal reserve', async () => {
    const {
        pool,
        PayoutCallbackStateMachineService,
        payoutService,
        eventBus
    } = await runtime();

    const request = {
        id: 162,
        seller_id: null,
        creator_id: null,
        buyer_id: 61,
        amount: '100.00',
        status: 'processing',
        provider_reference: 'TRF-BUYER-REFUND-SUCCESS',
        idempotency_key: 'BUYER-REFUND-WD-2',
        entity_phone: '0711111111',
        metadata: {
            withdrawal_fee: 21,
            total_deducted: 121
        }
    };
    const client = new FakeClient([
        respond(text => /WITH matched_ids AS/.test(text) && /FOR UPDATE OF wr/.test(text), [request]),
        respond(text => /SELECT id FROM buyers WHERE id = \$1 FOR UPDATE/.test(text), [{ id: 61 }]),
        respond(text => /UPDATE withdrawal_requests/.test(text) && /status = \$1/.test(text), [{ ...request, status: 'completed' }]),
        respond(text => /UPDATE buyers/.test(text) && /refund_withdrawal_reserved_balance/.test(text), [{ id: 61 }]),
        respond(text => /UPDATE payout_provider_attempts/.test(text), [])
    ]);

    await withPatches([
        [pool, 'connect', async () => client],
        [payoutService, 'refundToWallet', async () => {
            throw new Error('refundToWallet must not run on transfer.success');
        }],
        [eventBus, 'enqueueInTransaction', async (_client, event, data) => ({ eventId: data.eventId || `${event}:test` })],
        [eventBus, 'dispatchManyAfterCommit', () => {}]
    ], async () => {
        const result = await PayoutCallbackStateMachineService.handleProviderCallback({
            paystack_event: 'transfer.success',
            transaction_reference: 'TRF-BUYER-REFUND-SUCCESS',
            client_reference: 'BUYER-REFUND-WD-2',
            status: 'success',
            amount: '100.00',
            mpesa_receipt: 'MPE-BUYER'
        }, { replayEventId: 'paystack:transfer.success:TRF-BUYER-REFUND-SUCCESS' });

        assert.equal(result.status, 'completed');
        assert.equal(result.withdrawalId, 162);
    });

    assert.ok(indexOfQuery(client, /SELECT id FROM buyers/) < indexOfQuery(client, /UPDATE withdrawal_requests/));
    assert.ok(indexOfQuery(client, /UPDATE withdrawal_requests/) < indexOfQuery(client, /UPDATE buyers/));
    assert.deepEqual(client.queries[indexOfQuery(client, /UPDATE buyers/)].params, [121, 61]);
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
        entity_phone: '0712345678',
        metadata: {
            withdrawal_fee: 10,
            total_deducted: 90
        }
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
            refunds.push({
                id: refundedRequest.id,
                totalDeducted: refundedRequest.metadata.total_deducted
            });
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

    assert.deepEqual(refunds, [{ id: 53, totalDeducted: 90 }]);
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
