import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function exists(path) {
  return existsSync(resolve(root, path));
}

function filesUnder(path) {
  const absolute = resolve(root, path);
  return readdirSync(absolute).flatMap(entry => {
    const resolved = resolve(absolute, entry);
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return filesUnder(resolve(path, entry));
    }
    return stat.isFile() && resolved.endsWith('.js') ? [resolved] : [];
  });
}

test('Payd payment webhook fails closed and uses raw-body HMAC verification', () => {
  const controller = read('src/controllers/payment.controller.js');
  const core = read('src/core/CorePaymentService.js');
  const middleware = read('src/middleware/paydWebhookSecurity.js');

  assert.match(controller, /signature:\s*req\.headers\['x-payd-signature'\]/);
  assert.match(controller, /rawBody:\s*req\.rawBody/);
  assert.match(core, /verifyWebhookSignature\(security\.signature,\s*security\.rawBody\)/);
  assert.match(middleware, /normalizeProviderReference\(req\.body\)/);
  assert.doesNotMatch(core, /:\s*true;\s*\/\/ fallback/);
});

test('service slot release uses schema column expires_at', () => {
  const core = read('src/core/CorePaymentService.js');
  const releaseHelper = read('src/shared/utils/reservationRelease.js');

  assert.match(core, /releaseOrderReservations\(client,\s*orderId\)/);
  assert.match(releaseHelper, /expires_at = NULL/);
  assert.doesNotMatch(core, /reserved_until/);
  assert.doesNotMatch(releaseHelper, /reserved_until/);
});

test('public polling and cron delegate successful completion to CorePaymentService', () => {
  const paymentService = read('src/services/payment.service.js');

  assert.match(paymentService, /source:\s*'status_polling'/);
  assert.match(paymentService, /source:\s*'payment_cron'/);
  assert.match(paymentService, /Legacy Payd callback entrypoint is disabled/);
  assert.doesNotMatch(paymentService, /this\.handleSuccessfulPayment\(\{/);
  assert.doesNotMatch(paymentService, /amount:\s*paydStatus\.amount\s*\?\?\s*payment\.amount/);
  assert.doesNotMatch(paymentService, /amount:\s*providerData\?\.amount\s*\?\?\s*payment\.amount/);
  assert.match(paymentService, /Legacy payment success mutation is disabled/);
  assert.match(paymentService, /Legacy payment callback mutation is disabled/);
});

test('payment cron claims rows with SKIP LOCKED before provider verification', () => {
  const paymentService = read('src/services/payment.service.js');

  assert.match(paymentService, /FOR UPDATE SKIP LOCKED/);
  assert.match(paymentService, /cron_claimed_until/);
});

test('reconciliation enqueues missing fulfillment jobs with the correct client argument', () => {
  const reconciliation = read('src/cron/reconciliationEngine.js');

  assert.match(reconciliation, /FulfillmentQueueService\.enqueue\(null,\s*order\.id\)/);
  assert.match(reconciliation, /pg_try_advisory_lock\(hashtext\(\$1\)\)/);
  assert.match(reconciliation, /pg_advisory_unlock\(hashtext\(\$1\)\)/);
  assert.match(reconciliation, /provider_result_ambiguous_manual_review_required/);
  assert.match(reconciliation, /requires_manual_review/);
  assert.match(reconciliation, /needs_manual_review/);
});

test('withdrawals consume caller idempotency keys instead of random-only keys', () => {
  const controller = read('src/controllers/withdrawal.controller.js');
  const service = read('src/services/withdrawal.service.js');
  const sellerApi = read('../src/api/sellerApi.ts');
  const sellerWithdrawalsHook = read('../src/components/seller/dashboard/hooks/useSellerWithdrawals.ts');

  assert.match(controller, /req\.headers\['idempotency-key'\]/);
  assert.match(controller, /Idempotency-Key header is required/);
  assert.match(service, /Idempotency-Key header is required/);
  assert.match(service, /WHERE seller_id = \$1\s+AND idempotency_key = \$2/);
  assert.doesNotMatch(service, /Math\.random\(\)/);
  assert.match(sellerApi, /idempotencyKey:\s*string/);
  assert.match(sellerApi, /Withdrawal idempotency key is required/);
  assert.doesNotMatch(sellerApi, /Math\.random\(\)/);
  assert.match(sellerWithdrawalsHook, /withdrawalIdempotencyKeyRef/);
  assert.match(sellerWithdrawalsHook, /idempotencyKey:\s*withdrawalIdempotencyKeyRef\.current/);
});

test('withdrawal retry claims rows with SKIP LOCKED lease', () => {
  const service = read('src/services/withdrawal.service.js');
  const loader = read('src/loaders/services.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(service, /retry_started_at/);
  assert.match(service, /retry_worker_id/);
  assert.match(service, /FOR UPDATE SKIP LOCKED/);
  assert.match(service, /startPayoutProviderAttempt/);
  assert.match(service, /provider_attempt_active/);
  assert.match(service, /markPayoutProviderAttemptAccepted/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS payout_provider_attempts/);
  assert.match(migration, /payout_provider_attempts_request_unique/);
  assert.match(loader, /cron\.schedule\('\*\/5 \* \* \* \*'/);
});

test('ambiguous payout provider failures are not auto-refunded', () => {
  const service = read('src/services/withdrawal.service.js');

  assert.match(service, /isAmbiguousPayoutProviderError/);
  assert.match(service, /provider_result_ambiguous/);
  assert.match(service, /provider_result_ambiguous_manual_review_required/);
  assert.match(service, /needs_manual_review/);
  assert.match(service, /currentRequest\.provider_reference \|\| ambiguousProviderResult/);
});

test('payout callbacks can recover timeout paths by idempotency client reference', () => {
  const callback = read('src/controllers/callback.controller.js');
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(callback, /PayoutCallbackStateMachineService\.handleProviderCallback/);
  assert.match(stateMachine, /data\.client_reference \|\| data\.idempotency_key/);
  assert.match(stateMachine, /wr\.idempotency_key = \$2/);
  assert.match(stateMachine, /ppa\.idempotency_key = \$2/);
  assert.match(stateMachine, /updatePayoutProviderAttempt/);
  assert.match(stateMachine, /eventId:\s*`withdrawal\.\$\{finalStatus\}/);
});

test('payout callback amount rejection preserves non-terminal manual-review state', () => {
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(stateMachine, /payout_callback_rejected/);
  assert.match(stateMachine, /callback_amount_rejected/);
  assert.match(stateMachine, /needs_manual_review/);
  assert.match(stateMachine, /AND status = 'processing'/);
  assert.doesNotMatch(stateMachine, /missing_valid_amount[\s\S]*updateStatusWithSideEffects\(request\.id, 'failed'/);
});

test('delayed payout success after refund enters compensation state without wallet mutation', () => {
  const callback = read('src/controllers/callback.controller.js');
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');
  const eventBus = read('src/events/eventBus.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(callback, /PayoutCallbackStateMachineService\.handleProviderCallback/);
  assert.match(stateMachine, /FOR UPDATE OF wr/);
  assert.match(stateMachine, /isSuccess && request\.status === 'failed'/);
  assert.match(stateMachine, /recordProviderSuccessAfterRefundLocked/);
  assert.match(stateMachine, /async recordProviderSuccessAfterRefund/);
  assert.match(stateMachine, /PROVIDER_SUCCESS_AFTER_REFUND/);
  assert.match(stateMachine, /status = 'compensation_required'/);
  assert.match(stateMachine, /provider_success_after_refund/);
  assert.match(stateMachine, /freeze_payout_retries/);
  assert.match(stateMachine, /AppEvents\.WITHDRAWAL\.COMPENSATION_REQUIRED/);
  assert.match(eventBus, /COMPENSATION_REQUIRED:\s*'withdrawal\.compensation_required'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS payout_reconciliation_events/);
  assert.match(migration, /payout_reconciliation_events_unique_reference/);
  assert.doesNotMatch(callback, /updateStatusWithSideEffects\(request\.id,\s*'completed'/);
});

test('payout callback state machine is extracted from withdrawal service', () => {
  const callback = read('src/controllers/callback.controller.js');
  const withdrawal = read('src/services/withdrawal.service.js');
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(callback, /PayoutCallbackStateMachineService\.handleProviderCallback\(data/);
  assert.match(withdrawal, /PayoutCallbackStateMachineService\.handleProviderCallback\(providerPayload,\s*context\)/);
  assert.match(withdrawal, /PayoutCallbackStateMachineService\.recordProviderSuccessAfterRefund\(requestId,\s*providerPayload,\s*refs\)/);
  assert.match(stateMachine, /class PayoutCallbackStateMachineService/);
  assert.match(stateMachine, /async handleProviderCallback\(providerPayload = \{\},\s*context = \{\}\)/);
  assert.match(stateMachine, /async markPayoutCallbackRejected\(client,\s*request,\s*reason,\s*metadata\)/);
  assert.match(stateMachine, /async recordProviderSuccessAfterRefundLocked\(client,\s*request,\s*providerPayload = \{\},\s*refs = \{\}\)/);
  assert.match(stateMachine, /providerPayloadIndicatesSuccess/);
  assert.match(stateMachine, /providerPayloadIndicatesFailure/);
  assert.doesNotMatch(withdrawal, /async recordProviderSuccessAfterRefundLocked/);
  assert.doesNotMatch(withdrawal, /async markPayoutCallbackRejected/);
  assert.doesNotMatch(withdrawal, /async recordAmbiguousPayoutCallbackLocked/);
  assert.doesNotMatch(withdrawal, /const PAYOUT_SUCCESS_STATUSES/);
});

test('EscrowManager remains isolated behind existing payout release callers', () => {
  const services = filesUnder('src/services');
  const escrowImporters = services
    .filter(file => /from ['"]\.\/EscrowManager\.js['"]/.test(readFileSync(file, 'utf8')))
    .map(file => basename(file))
    .sort();

  const orderService = read('src/services/order.service.js');
  const deadlineService = read('src/services/orderDeadline.service.js');
  const inventoryService = read('src/services/inventoryReservation.service.js');
  const fulfillmentTransition = read('src/services/orderFulfillmentTransition.service.js');
  const payoutCallbackStateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.deepEqual(escrowImporters, ['order.service.js', 'orderDeadline.service.js']);
  assert.match(orderService, /escrowManager\.releaseFunds\(client,\s*order,\s*'OrderService'\)/);
  assert.match(deadlineService, /escrowManager\.releaseFunds\(client,\s*order,\s*'OrderDeadlineService'\)/);
  assert.doesNotMatch(inventoryService, /EscrowManager|escrowManager|releaseFunds/);
  assert.doesNotMatch(fulfillmentTransition, /EscrowManager|escrowManager|releaseFunds/);
  assert.doesNotMatch(payoutCallbackStateMachine, /EscrowManager|escrowManager|releaseFunds/);
});

test('fulfillment retry cron routes through fulfillment queue', () => {
  const cron = read('src/cron/paymentCron.js');

  assert.match(cron, /FulfillmentQueueService\.enqueue\(null,\s*payment\.order_id\)/);
  assert.doesNotMatch(cron, /OrderService\.completeOrder\(payment\)/);
});

test('checkout idempotency is persisted in product_orders', () => {
  const orderModel = read('src/models/order.model.js');
  const paymentService = read('src/services/payment.service.js');
  const controller = read('src/controllers/payment.controller.js');
  const productCard = read('../src/components/ProductCard.tsx');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(orderModel, /client_checkout_token/);
  assert.match(paymentService, /client_checkout_token = \$1/);
  assert.match(paymentService, /Recovered existing checkout after unique race/);
  assert.match(controller, /Checkout idempotency token is required/);
  assert.match(productCard, /checkoutAttemptTokenRef/);
  assert.match(productCard, /'Idempotency-Key': checkoutToken/);
  assert.match(productCard, /client_checkout_token: checkoutToken/);
  assert.match(migration, /ALTER COLUMN client_checkout_token SET NOT NULL/);
  assert.match(migration, /product_orders_client_checkout_token_unique_all/);
});

test('payment provider attempts are durable before gateway network calls', () => {
  const paymentService = read('src/services/payment.service.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS payment_provider_attempts/);
  assert.match(migration, /payment_provider_attempts_payment_unique/);
  assert.match(paymentService, /createPaymentProviderAttempt\(client/);
  assert.match(paymentService, /markPaymentProviderAttemptStarted\(payment\.id\)/);
  assert.match(paymentService, /markPaymentProviderAttemptAccepted/);
  assert.match(paymentService, /markPaymentProviderAttemptFailed/);
  assert.match(paymentService, /const statusReference = payment\.provider_reference \|\| payment\.api_ref/);
});

test('deterministic gateway initiation failure releases reservations and marks payment/order failed transactionally', () => {
  const paymentService = read('src/services/payment.service.js');

  assert.match(paymentService, /markPaymentInitiationFailed/);
  assert.match(paymentService, /releaseOrderReservations\(client,\s*orderId\)/);
  assert.match(paymentService, /UPDATE payments[\s\S]*status = 'failed'/);
  assert.match(paymentService, /UPDATE product_orders[\s\S]*status = 'FAILED'/);
  assert.match(paymentService, /payment_initiation_failure/);
});

test('ambiguous gateway initiation failures stay pending for webhook recovery', () => {
  const paymentService = read('src/services/payment.service.js');

  assert.match(paymentService, /isAmbiguousPaymentProviderError/);
  assert.match(paymentService, /PaydErrorCodes\.TIMEOUT/);
  assert.match(paymentService, /PaydErrorCodes\.CONNECTION_FAILED/);
  assert.match(paymentService, /markPaymentProviderAttemptAmbiguous/);
  assert.match(paymentService, /provider_result_ambiguous/);
  assert.match(paymentService, /markPaymentInitiationAmbiguous/);
  assert.match(paymentService, /keeping payment pending for webhook\/cron settlement/);
  assert.match(paymentService, /ambiguous:\s*true/);
});

test('fraud evidence is persisted outside the rolled-back transaction', () => {
  const core = read('src/core/CorePaymentService.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(core, /recordFraudEvent\(fraudEvent\)/);
  assert.match(core, /missing_or_invalid_success_amount/);
  assert.match(core, /amount_mismatch/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS fraud_events/);
  assert.match(migration, /expected_amount/);
  assert.match(migration, /provider_amount/);
  assert.match(migration, /payload JSONB/);
});

test('external notification side effects are emitted through EventBus from critical services', () => {
  const orderService = read('src/services/order.service.js');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const fulfillmentQueue = read('src/services/fulfillmentQueue.service.js');
  const adminController = read('src/controllers/admin.controller.js');
  const refundController = read('src/controllers/refund.controller.js');
  const referralService = read('src/services/referral.service.js');
  const orderDeadlineService = read('src/services/orderDeadline.service.js');
  const events = read('src/events/order.events.js') + read('src/events/payment.events.js');

  assert.doesNotMatch(orderService, /whatsappService\./);
  assert.doesNotMatch(withdrawalService, /whatsappService\./);
  assert.doesNotMatch(adminController, /whatsappService\./);
  assert.doesNotMatch(refundController, /whatsappService\./);
  assert.doesNotMatch(referralService, /whatsappService\./);
  assert.doesNotMatch(orderDeadlineService, /whatsappService\./);
  assert.match(fulfillmentQueue, /AppEvents\.ORDER\.FULFILLED/);
  assert.match(withdrawalService, /AppEvents\.WITHDRAWAL\.CREATED/);
  assert.match(withdrawalService, /AppEvents\.WITHDRAWAL\.UPDATED/);
  assert.match(refundController, /AppEvents\.REFUND\.APPROVED/);
  assert.match(refundController, /AppEvents\.REFUND\.REJECTED/);
  assert.match(referralService, /AppEvents\.REFERRAL\.REWARD_CREATED/);
  assert.match(events, /notifyBuyerDigitalDelivery/);
  assert.match(events, /notifySellerWithdrawalUpdate/);
  assert.doesNotMatch(events, /Event:OrderFulfilled[\s\S]*notifySellerNewOrder/);
});

test('EventBus uses durable event-id dedupe for multi-instance notification suppression', () => {
  const eventBus = read('src/events/eventBus.js');
  const loader = read('src/loaders/services.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(eventBus, /INSERT INTO event_dedupe/);
  assert.match(eventBus, /INSERT INTO event_outbox/);
  assert.match(eventBus, /enqueueInTransaction/);
  assert.match(eventBus, /dispatchOutboxEvent/);
  assert.match(eventBus, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.match(eventBus, /replayPendingOutbox/);
  assert.match(eventBus, /FOR UPDATE SKIP LOCKED/);
  assert.match(eventBus, /deferring side-effect event until outbox claim succeeds/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_dedupe/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_outbox/);
  assert.match(migration, /idx_event_outbox_retry/);
  assert.match(loader, /eventBus\.replayPendingOutbox/);
});

test('important post-commit lifecycle events prefer durable outbox rows', () => {
  const eventBus = read('src/events/eventBus.js');
  const orderService = read('src/services/order.service.js');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const payoutStateMachine = read('src/services/payoutCallbackStateMachine.service.js');
  const refundController = read('src/controllers/refund.controller.js');
  const adminController = read('src/controllers/admin.controller.js');
  const referralService = read('src/services/referral.service.js');
  const coreOrder = read('src/core/CoreOrderService.js');

  assert.match(eventBus, /async enqueue\(event, payload = \{\}\)/);
  assert.match(eventBus, /dispatchAfterCommit\(eventId/);
  assert.match(eventBus, /async enqueueAndDispatch\(event, payload = \{\}, context = 'EventBus'\)/);

  assert.match(orderService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.CREATED/);
  assert.match(orderService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.CANCELLED/);
  assert.match(orderService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.PAID/);
  assert.match(orderService, /enqueueAndDispatch\(AppEvents\.ORDER\.UPDATED/);
  assert.match(withdrawalService, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.CREATED/);
  assert.match(withdrawalService, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.UPDATED/);
  assert.match(payoutStateMachine, /enqueueInTransaction\(\s*client,\s*AppEvents\.WITHDRAWAL\.COMPENSATION_REQUIRED/);
  assert.match(refundController, /enqueueInTransaction\(client,\s*AppEvents\.REFUND\.APPROVED/);
  assert.match(refundController, /enqueueAndDispatch\(AppEvents\.REFUND\.REJECTED/);
  assert.match(adminController, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.UPDATED/);
  assert.match(referralService, /enqueueInTransaction\(client,\s*AppEvents\.REFERRAL\.REWARD_CREATED/);
  assert.match(orderService, /eventBus\.emit\(AppEvents\.INVENTORY\.LOW_STOCK/);
  assert.match(orderService, /eventBus\.emit\(AppEvents\.INVENTORY\.OUT_OF_STOCK/);
  assert.doesNotMatch(coreOrder, /eventBus\.emit|setImmediate/);

  const activeRuntime = [
    orderService,
    withdrawalService,
    payoutStateMachine,
    refundController,
    adminController,
    referralService
  ].join('\n');
  assert.doesNotMatch(activeRuntime, /eventBus\.emit\(AppEvents\.(ORDER|PAYMENT|WITHDRAWAL|REFUND|REFERRAL)\./);

  const directEmitSites = [
    ['order.service.js', orderService],
    ['withdrawal.service.js', withdrawalService],
    ['payoutCallbackStateMachine.service.js', payoutStateMachine],
    ['refund.controller.js', refundController],
    ['admin.controller.js', adminController],
    ['referral.service.js', referralService],
    ['CoreOrderService.js', coreOrder],
    ['CorePaymentService.js', read('src/core/CorePaymentService.js')],
    ['payment.service.js', read('src/services/payment.service.js')],
    ['orderDeadline.service.js', read('src/services/orderDeadline.service.js')],
    ['fulfillmentQueue.service.js', read('src/services/fulfillmentQueue.service.js')]
  ].flatMap(([file, source]) =>
    Array.from(source.matchAll(/eventBus\.emit\(AppEvents\.(\w+)\.(\w+)/g))
      .map(match => ({
        file,
        namespace: match[1],
        event: match[2]
      }))
  ).sort((a, b) => `${a.file}:${a.namespace}:${a.event}`.localeCompare(`${b.file}:${b.namespace}:${b.event}`));

  assert.deepEqual(directEmitSites, [
    { file: 'order.service.js', namespace: 'INVENTORY', event: 'LOW_STOCK' },
    { file: 'order.service.js', namespace: 'INVENTORY', event: 'OUT_OF_STOCK' }
  ]);
});

test('EventBus outbox only completes after listener delivery succeeds', () => {
  const eventBus = read('src/events/eventBus.js');
  const orderEvents = read('src/events/order.events.js');
  const paymentEvents = read('src/events/payment.events.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(eventBus, /classifyDeliveryError/);
  assert.match(eventBus, /delivery_attempts/);
  assert.match(eventBus, /permanently_failed/);
  assert.match(eventBus, /transient_delivery_failure/);
  assert.match(eventBus, /last_error_type/);
  assert.match(orderEvents, /async function deliverAll/);
  assert.match(orderEvents, /Promise\.allSettled/);
  assert.doesNotMatch(orderEvents, /whatsappService\.[\s\S]*\.catch\(/);
  assert.doesNotMatch(paymentEvents, /whatsappService\.[\s\S]*\.catch\(/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS delivery_attempts/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS final_failure_at/);
});

test('payout callbacks require HMAC, timestamp, and replay protection before mutation', () => {
  const route = read('src/routes/callback.routes.js');
  const middleware = read('src/middleware/paydWebhookSecurity.js');
  const callback = read('src/controllers/callback.controller.js');
  const migration = read('migrations/20260508010000_webhook_replay_and_notification_delivery.sql');
  const hardeningMigration = read('migrations/20260508020000_provider_callback_hardening.sql');

  assert.match(route, /requirePaydWebhookHmac/);
  assert.match(route, /webhookRateLimiter,\s*verifyPaydWebhook,\s*requirePaydWebhookHmac,\s*handlePaydPayoutCallback/);
  assert.match(middleware, /verifyPaydHmacSignature/);
  assert.match(middleware, /x-payd-signature/);
  assert.match(middleware, /x-payd-timestamp/);
  assert.match(middleware, /webhook_replay_dedupe/);
  assert.match(middleware, /Webhook already processed/);
  assert.match(middleware, /Webhook already processing/);
  assert.match(callback, /req\.webhookSecurity\?\.hmacVerified/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS webhook_replay_dedupe/);
  assert.match(hardeningMigration, /ADD COLUMN IF NOT EXISTS status/);
});

test('payment webhook route also requires HMAC and replay protection', () => {
  const route = read('src/routes/payment.routes.js');

  assert.match(route, /requirePaydWebhookHmac/);
  assert.match(route, /verifyPaydWebhook,\s*webhookRateLimiter,\s*requirePaydWebhookHmac,\s*paymentController\.handlePaydWebhook/);
});

test('manual-review payment mapping failures are terminal and not retried as pending', () => {
  const core = read('src/core/CorePaymentService.js');
  const enums = read('src/shared/constants/enums.js');

  assert.match(enums, /MANUAL_REVIEW_REQUIRED:\s*'manual_review_required'/);
  assert.match(enums, /PAYMENT_MAPPING_FAILED:\s*'payment_mapping_failed'/);
  assert.match(core, /status = 'manual_review_required'/);
  assert.match(core, /Payment is in a manual review terminal state/);
});

test('direct order creation routes are retired in favor of payment initiation', () => {
  const controller = read('src/controllers/order.controller.js');
  const orderRoutes = read('src/routes/orderRoutes.js');
  const sellerRoutes = read('src/routes/seller.routes.js');
  const orderValidation = read('src/validations/order.validation.js');
  const service = read('src/services/order.service.js');
  const paymentRoutes = read('src/routes/payment.routes.js');
  const createOrderHandler = controller.slice(
    controller.indexOf('export const createOrder'),
    controller.indexOf('export const getOrderById')
  );

  assert.match(createOrderHandler, /DIRECT_ORDER_CREATION_RETIRED/);
  assert.match(createOrderHandler, /\/api\/payments\/initiate-product/);
  assert.doesNotMatch(createOrderHandler, /OrderService\.createOrder/);
  assert.doesNotMatch(orderRoutes, /validate\(createOrderSchema\)/);
  assert.doesNotMatch(orderRoutes, /createOrderSchema/);
  assert.doesNotMatch(orderValidation, /createOrderSchema/);
  assert.match(sellerRoutes, /Retired direct order creation endpoint/);
  assert.match(paymentRoutes, /\/initiate-product/);
  assert.match(service, /Checkout idempotency token is required/);
  assert.match(service, /SELECT \* FROM product_orders WHERE client_checkout_token = \$1 FOR UPDATE/);
  assert.match(service, /lock:order_create:\$\{normalizedCheckoutToken\}/);
});

test('critical event listeners are registered before loaders and zero-listener critical events fail retryably', () => {
  const index = read('src/index.js');
  const eventBus = read('src/events/eventBus.js');

  assert.match(index, /await import\('\.\/events\/order\.events\.js'\)/);
  assert.match(index, /await eventBus\.verifyRequiredListeners\(\)/);
  assert.match(index, /await loaders\(app\)/);
  assert.match(eventBus, /criticalEvents = new Set/);
  assert.match(eventBus, /Critical event \$\{event\} has no registered listeners/);
  assert.match(eventBus, /verifyRequiredListeners/);
});

test('notification retries are tracked per recipient to avoid duplicate partial deliveries', () => {
  const eventBus = read('src/events/eventBus.js');
  const orderEvents = read('src/events/order.events.js');
  const paymentEvents = read('src/events/payment.events.js');
  const migration = read('migrations/20260508010000_webhook_replay_and_notification_delivery.sql');

  assert.match(eventBus, /deliverRecipient/);
  assert.match(eventBus, /event_recipient_deliveries/);
  assert.match(eventBus, /Recipient delivery already completed; suppressing duplicate/);
  assert.match(orderEvents, /eventBus\.deliverRecipient/);
  assert.match(paymentEvents, /eventBus\.deliverRecipient/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_recipient_deliveries/);
  assert.match(migration, /event_recipient_deliveries_unique/);
});

test('EventBus defers side effects when outbox claim DB is unavailable', () => {
  const eventBus = read('src/events/eventBus.js');

  assert.match(eventBus, /pendingClaimRetries/);
  assert.match(eventBus, /scheduleClaimRetry/);
  assert.match(eventBus, /flushPendingClaimRetries/);
  assert.match(eventBus, /reason:\s*'db_unavailable'/);
  assert.match(eventBus, /deferring side-effect event until outbox claim succeeds/);
  assert.match(eventBus, /if \(!claim\.claimed\)/);
  assert.match(eventBus, /claim\.retryable/);
});

test('startup schema check hard-fails when critical fintech structures are missing', () => {
  const schemaCheck = read('src/loaders/schemaCheck.js');

  assert.match(schemaCheck, /Critical fintech schema verification failed/);
  assert.match(schemaCheck, /fraud_events/);
  assert.match(schemaCheck, /event_outbox/);
  assert.match(schemaCheck, /payout_provider_attempts/);
  assert.match(schemaCheck, /payout_reconciliation_events/);
  assert.match(schemaCheck, /withdrawal_requests_seller_idempotency_unique/);
  assert.match(schemaCheck, /product_orders_client_checkout_token_unique_all/);
  assert.match(schemaCheck, /fulfillment_jobs_order_id_unique/);
  assert.match(schemaCheck, /payout_provider_attempts_provider_reference_unique/);
  assert.match(schemaCheck, /withdrawal_requests_provider_reference_unique/);
  assert.match(schemaCheck, /idx_webhook_replay_dedupe_status/);
  assert.match(schemaCheck, /retry_started_at/);
  assert.match(schemaCheck, /retry_worker_id/);
  assert.match(schemaCheck, /pg_try_advisory_lock\(hashtext\(\$1\)\)/);
  assert.doesNotMatch(schemaCheck, /Attempting to create/);
});

test('fraud-recorded payment webhooks are acknowledged to stop provider retry storms', () => {
  const controller = read('src/controllers/payment.controller.js');

  assert.match(controller, /verified_provider_payload_rejected/);
  assert.match(controller, /missing valid amount/);
  assert.match(controller, /Amount mismatch/);
});

test('payment completion resolves orders only from explicit order metadata', () => {
  const core = read('src/core/CorePaymentService.js');

  assert.match(core, /function resolveOrderIdFromMetadata\(metadata = \{\}\)/);
  assert.match(core, /meta\.order_id \?\? meta\.product_order_id/);
  assert.match(core, /missing_order_reference/);
  assert.match(core, /requires_manual_review/);
  assert.match(core, /recordFraudEvent\(fraudEvent\)/);
  assert.doesNotMatch(core, /meta\.product_id/);
  assert.doesNotMatch(core, /metadataOrderId/);
});

test('database payment status values cover every runtime payment status', () => {
  const core = read('src/core/CorePaymentService.js');
  const enums = read('src/shared/constants/enums.js');
  const schemaCheck = read('src/loaders/schemaCheck.js');
  const enumMigration = read('migrations/20260509010000_sync_payment_status_values.sql');
  const columnMigration = read('migrations/20260509010100_enforce_payment_status_columns.sql');

  for (const status of [
    'pending',
    'completed',
    'failed',
    'cancelled',
    'success',
    'paid',
    'manual_review_required',
    'payment_mapping_failed',
    'compensation_required'
  ]) {
    assert.match(enumMigration, new RegExp(`'${status}'`));
    assert.match(columnMigration, new RegExp(`'${status}'`));
  }

  assert.match(enums, /PAID:\s*'paid'/);
  assert.match(core, /PaymentStatus\.PAID/);
  assert.match(enumMigration, /CREATE TYPE public\.payment_status AS ENUM/);
  assert.match(enumMigration, /ALTER TYPE public\.payment_status ADD VALUE IF NOT EXISTS 'compensation_required'/);
  assert.match(columnMigration, /ALTER COLUMN status TYPE public\.payment_status/);
  assert.match(columnMigration, /ALTER COLUMN payment_status TYPE public\.payment_status/);
  assert.match(columnMigration, /Cannot convert payments\.status to payment_status/);
  assert.match(columnMigration, /Cannot convert product_orders\.payment_status to payment_status/);
  assert.match(schemaCheck, /REQUIRED_PAYMENT_STATUS_VALUES/);
  assert.match(schemaCheck, /missing_payment_status_enum_value/);
  assert.match(schemaCheck, /payment_status_column_type_mismatch/);
});

test('provider payment lookups cannot fall through to internal payment ids', () => {
  const core = read('src/core/CorePaymentService.js');
  const paymentService = read('src/services/payment.service.js');

  assert.match(core, /async function findPaymentByProviderReference/);
  assert.match(core, /async function findPaymentByInternalId/);
  assert.match(core, /Ambiguous provider payment reference rejected/);
  assert.match(core, /matchedPaymentIds/);
  assert.doesNotMatch(core, /id::text/);
  assert.doesNotMatch(paymentService, /WHERE id::text = \$1/);
  assert.match(paymentService, /WHERE provider_reference = \$1\s+OR invoice_id = \$1\s+OR api_ref = \$1/);
});

test('payout callback references cannot resolve ambiguously across withdrawals', () => {
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');
  const migration = read('migrations/20260508020000_provider_callback_hardening.sql');

  assert.match(stateMachine, /matchedRequests\.length > 1/);
  assert.match(stateMachine, /PAYOUT_REFERENCE_AMBIGUOUS/);
  assert.match(stateMachine, /Ambiguous payout callback reference rejected before mutation/);
  assert.match(migration, /payout_provider_attempts_provider_reference_unique/);
  assert.match(migration, /withdrawal_requests_provider_reference_unique/);
});

test('CORS allows idempotency and request tracing headers used by safe retries', () => {
  const expressLoader = read('src/loaders/express.js');
  const productCard = read('../src/components/ProductCard.tsx');
  const buyerApi = read('../src/api/buyerApi.ts');
  const sellerApi = read('../src/api/sellerApi.ts');

  assert.match(expressLoader, /'Idempotency-Key'/);
  assert.match(expressLoader, /'X-Checkout-Token'/);
  assert.match(expressLoader, /'X-Idempotency-Key'/);
  assert.match(expressLoader, /'X-Request-Id'/);
  assert.match(productCard, /'Idempotency-Key': checkoutToken/);
  assert.match(buyerApi, /'Idempotency-Key': idempotencyKey/);
  assert.match(sellerApi, /'Idempotency-Key': data\.idempotencyKey/);
});

test('fulfillment worker delegates claiming and processing to queue service', () => {
  const worker = read('src/cron/fulfillmentWorker.js');
  const queue = read('src/services/fulfillmentQueue.service.js');

  assert.match(worker, /FULFILLMENT_WORKER_BATCH_SIZE/);
  assert.match(worker, /FulfillmentQueueService\.processJobs\(batchSize\)/);
  assert.match(queue, /WITH claimed AS/);
  assert.match(queue, /FOR UPDATE SKIP LOCKED/);
  assert.match(queue, /UPDATE fulfillment_jobs fj/);
  assert.match(queue, /FULFILLMENT_WORKER_CONCURRENCY/);
  assert.match(queue, /Promise\.allSettled/);
  assert.match(queue, /OrderFulfillmentTransitionService\.executeFulfillment\(client,\s*order\)/);
  assert.doesNotMatch(queue, /await import\('\.\/order\.service\.js'\)/);
  assert.doesNotMatch(queue, /OrderService\.executeFulfillment/);
});

test('fulfillment transitions are isolated from order service orchestration', () => {
  const orderService = read('src/services/order.service.js');
  const transitionService = read('src/services/orderFulfillmentTransition.service.js');

  assert.match(orderService, /OrderFulfillmentTransitionService\.executeFulfillment\(client,\s*order\)/);
  assert.match(transitionService, /class OrderFulfillmentTransitionService/);
  assert.match(transitionService, /static async completePhysicalOrder\(client,\s*order,\s*items\)/);
  assert.match(transitionService, /static async completeServiceOrder\(client,\s*order\)/);
  assert.match(transitionService, /static async completeDigitalOrder\(client,\s*order,\s*items\)/);
  assert.match(transitionService, /InventoryReservationService\.commitReservedInventory\(client,\s*items\)/);
  assert.match(transitionService, /BookingService\.finalizeSlot\(client,\s*order\.id\)/);
  assert.match(transitionService, /assertValidTransition\(order\.status,\s*OrderStatus\.FULFILLMENT_PENDING/);
  assert.match(transitionService, /assertValidTransition\(order\.status,\s*OrderStatus\.BOOKED/);
  assert.match(transitionService, /assertValidTransition\(order\.status,\s*OrderStatus\.DELIVERY_PENDING/);
  assert.doesNotMatch(orderService, /static async _completePhysicalOrder/);
  assert.doesNotMatch(orderService, /static async _completeServiceOrder/);
  assert.doesNotMatch(orderService, /static async _completeDigitalOrder/);
  assert.doesNotMatch(orderService, /static async _grantDigitalAccessFlow/);
  assert.doesNotMatch(orderService, /static async _finalizeServiceSlot/);
  assert.doesNotMatch(orderService, /BookingService/);
});

test('fulfillment enqueue never reopens completed jobs', () => {
  const queue = read('src/services/fulfillmentQueue.service.js');

  assert.match(queue, /fulfillment_jobs\.status IN \('PENDING', 'FAILED'\)/);
  assert.match(queue, /fulfillment_jobs\.status = 'PROCESSING'/);
  assert.match(queue, /already terminal or actively processing/);
  assert.doesNotMatch(queue, /ON CONFLICT \(order_id\) DO UPDATE SET status = 'PENDING', attempts = 0/);
});

test('deadline reservation cleanup uses locked shared release helper', () => {
  const deadline = read('src/services/orderDeadline.service.js');

  assert.match(deadline, /releaseOrderReservations\(client,\s*order\.id\)/);
  assert.match(deadline, /FOR UPDATE SKIP LOCKED/);
  assert.match(deadline, /status IN \('RESERVED', 'HELD'\)/);
  assert.doesNotMatch(deadline, /reserved_quantity = GREATEST\(0, reserved_quantity - \$1\)/);
});

test('inventory finalization fails closed instead of masking reserved underflow', () => {
  const inventoryService = read('src/services/inventoryReservation.service.js');

  assert.match(inventoryService, /reserved_quantity = p\.reserved_quantity - v\.qty/);
  assert.match(inventoryService, /AND p\.reserved_quantity >= v\.qty/);
  assert.match(inventoryService, /Reserved inventory invariant failed/);
  assert.match(inventoryService, /COALESCE\(LOWER\(p\.product_type::text\), ''\) <> 'digital'/);
  assert.doesNotMatch(inventoryService, /reserved_quantity = GREATEST\(0, reserved_quantity - \$1\)/);
});

test('order service delegates inventory reservation lifecycle to dedicated service', () => {
  const orderService = read('src/services/order.service.js');
  const reservationRelease = read('src/shared/utils/reservationRelease.js');
  const inventoryService = read('src/services/inventoryReservation.service.js');
  const transitionService = read('src/services/orderFulfillmentTransition.service.js');

  assert.match(orderService, /InventoryReservationService\.enrichItemsWithProductData\(client,\s*items\)/);
  assert.match(orderService, /InventoryReservationService\.checkInventory\(items\)/);
  assert.match(orderService, /InventoryReservationService\.reserveInventory\(client,\s*items\)/);
  assert.match(orderService, /InventoryReservationService\.releaseOrderInventory\(client,\s*orderId\)/);
  assert.match(transitionService, /InventoryReservationService\.commitReservedInventory\(client,\s*items\)/);
  assert.match(reservationRelease, /InventoryReservationService\.releaseOrderInventory\(client,\s*orderId\)/);
  assert.match(inventoryService, /static async reserveInventory\(client,\s*items\)/);
  assert.match(inventoryService, /static async releaseInventory\(client,\s*items\)/);
  assert.match(inventoryService, /static async commitReservedInventory\(client,\s*items\)/);
  assert.doesNotMatch(orderService, /static async _enrichItemsWithProductData/);
  assert.doesNotMatch(orderService, /static async _reserveInventory/);
  assert.doesNotMatch(orderService, /static async _releaseInventory/);
  assert.doesNotMatch(orderService, /static _checkInventory/);
  assert.doesNotMatch(orderService, /static async _finalizeInventory/);
  assert.doesNotMatch(orderService, /ProductModel\.commit/);
});

test('WhatsApp delivery suppresses duplicate notifications', () => {
  const whatsapp = read('src/services/whatsapp.service.js');

  assert.match(whatsapp, /recentMessageKeys/);
  assert.match(whatsapp, /Duplicate notification suppressed/);
  assert.match(whatsapp, /buildMessageKey\(jid,\s*message\)/);
});

test('buyer product grid uses React Query cache instead of local fetch effect churn', () => {
  const productGrid = read('../src/components/ProductGrid.tsx');
  const productGridHook = read('../src/components/product-grid/usePublicProductsGrid.ts');

  assert.match(productGrid, /usePublicProductsGrid/);
  assert.match(productGridHook, /useQuery/);
  assert.match(productGridHook, /queryKey:\s*\['public-products'/);
  assert.match(productGridHook, /staleTime:\s*60_000/);
  assert.doesNotMatch(productGrid, /requestCache/);
  assert.doesNotMatch(productGrid, /fetchProducts/);
  assert.doesNotMatch(productGrid, /useEffect\(/);
  assert.doesNotMatch(productGridHook, /useEffect\(/);
});

test('seller dashboard summary uses React Query cache and avoids page reload refreshes', () => {
  const sellerDashboard = read('../src/components/seller/SellerDashboard.tsx');
  const sellerDashboardDataHook = read('../src/components/seller/dashboard/hooks/useSellerDashboardData.ts');
  const sellerDashboardQueryKeys = read('../src/components/seller/dashboard/queryKeys.ts');
  const productCard = read('../src/components/ProductCard.tsx');
  const adminDashboard = read('../src/pages/admin/NewDashboardPage.tsx');

  assert.match(sellerDashboard, /useSellerDashboardData/);
  assert.match(sellerDashboardDataHook, /useQuery/);
  assert.match(sellerDashboardQueryKeys, /products:\s*\['seller-dashboard', 'products'\]/);
  assert.match(sellerDashboardQueryKeys, /analytics:\s*\['seller-dashboard', 'analytics'\]/);
  assert.match(sellerDashboardDataHook, /staleTime:\s*60_000/);
  assert.match(sellerDashboardDataHook, /queryClient\.fetchQuery/);
  assert.match(sellerDashboardDataHook, /queryClient\.invalidateQueries/);
  assert.doesNotMatch(sellerDashboard, /window\.location\.reload/);
  assert.doesNotMatch(productCard, /Math\.random/);
  assert.doesNotMatch(adminDashboard, /Math\.random/);
  assert.doesNotMatch(adminDashboard, /window\.location\.reload/);
  assert.match(adminDashboard, /dashboardReloadToken/);
  assert.match(adminDashboard, /setDashboardReloadToken\(token => token \+ 1\)/);
  assert.match(adminDashboard, /inspectionSessionId/);
});

test('global auth revalidates on TTL expiry, route role change, focus, and visibility restore', () => {
  const authContext = read('../src/contexts/AuthCoreContext.tsx');
  const globalAuthContext = read('../src/contexts/GlobalAuthContext.tsx');
  const buyerAuthContext = read('../src/contexts/BuyerAuthContext.tsx');
  const sellerAuthContext = read('../src/contexts/SellerAuthContext.tsx');
  const adminAuthContext = read('../src/contexts/AdminAuthContext.tsx');

  assert.match(authContext, /lastRouteRoleRef/);
  assert.match(authContext, /routeRoleChanged/);
  assert.match(authContext, /Date\.now\(\) - lastCheckRef\.current > AUTH_TTL/);
  assert.match(authContext, /window\.addEventListener\('focus', revalidateOnResume\)/);
  assert.match(authContext, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(authContext, /document\.visibilityState === 'visible'/);
  assert.match(authContext, /checkAuth\(true\)/);
  assert.match(authContext, /window\.removeEventListener\('focus', revalidateOnResume\)/);
  assert.match(authContext, /export function AuthCoreProvider/);
  assert.doesNotMatch(authContext, /BuyerAuthContext\.Provider|SellerAuthContext\.Provider|AdminAuthContext\.Provider/);
  assert.match(globalAuthContext, /<AuthCoreProvider>/);
  assert.match(globalAuthContext, /<BuyerAuthProvider>/);
  assert.match(globalAuthContext, /<SellerAuthProvider>/);
  assert.match(globalAuthContext, /<AdminAuthProvider>/);
  assert.match(buyerAuthContext, /export function BuyerAuthProvider/);
  assert.match(sellerAuthContext, /export function SellerAuthProvider/);
  assert.match(adminAuthContext, /export function AdminAuthProvider/);
});

test('public pagination and lists use deterministic ordering', () => {
  const publicController = read('src/controllers/public.controller.js');

  assert.match(publicController, /ORDER BY p\.created_at DESC, p\.id DESC LIMIT/);
  assert.match(publicController, /ORDER BY total_wishlist_count DESC, s\.id ASC/);
  assert.match(publicController, /ORDER BY time_slot ASC, id ASC/);
});

test('webhook rate limiting uses Redis when available with local fallback', () => {
  const middleware = read('src/middleware/paydWebhookSecurity.js');

  assert.match(middleware, /cacheService/);
  assert.match(middleware, /redis\?\.incr/);
  assert.match(middleware, /rate:webhook:payd/);
  assert.match(middleware, /fallbackMemoryLimit/);
});

test('shadow completion and deadline crons cannot bypass hardened services', () => {
  const coreOrder = read('src/core/CoreOrderService.js');
  const cronLoader = read('src/loaders/cron.js');
  const index = read('src/index.js');
  const shadowOrder = read('src/modules/orders/order.service.js');
  const paymentCron = read('src/cron/paymentCron.js');
  const fulfillmentWorker = read('src/cron/fulfillmentWorker.js');
  const reconciliation = read('src/cron/reconciliationEngine.js');

  assert.match(coreOrder, /USE_MODULAR_ORDERS is hard-disabled/);
  assert.doesNotMatch(coreOrder, /getModularService/);
  assert.doesNotMatch(coreOrder, /getActiveService/);
  assert.doesNotMatch(coreOrder, /\.\.\/modules\/orders\/order\.service\.js/);
  assert.doesNotMatch(coreOrder, /falling back to legacy/);
  assert.equal(exists('src/cron/completionRetryCron.js'), false);
  assert.equal(exists('src/cron/orderDeadlineCron.js'), false);
  assert.doesNotMatch(cronLoader, /completionRetryCron|orderDeadlineCron/);
  assert.doesNotMatch(index, /completionRetryCron|orderDeadlineCron/);
  assert.match(paymentCron, /FulfillmentQueueService\.enqueue\(null,\s*payment\.order_id\)/);
  assert.match(fulfillmentWorker, /FulfillmentQueueService\.processJobs/);
  assert.match(reconciliation, /FulfillmentQueueService\.enqueue\(null,\s*order\.id\)/);
  assert.doesNotMatch(paymentCron, /legacy handlePaydCallback/);
  assert.doesNotMatch(paymentCron, /handlePaydCallback has an idempotency check/);
  assert.match(shadowOrder, /Deprecated modules\/orders service delegated/);
  assert.match(shadowOrder, /ActiveOrderService\.createOrder/);
  assert.match(shadowOrder, /ActiveOrderService\.updateOrderStatus/);
  assert.match(shadowOrder, /ActiveOrderService\.completeOrder/);
});
