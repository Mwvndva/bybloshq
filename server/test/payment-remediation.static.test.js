import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
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
  const sellerDashboard = read('../src/components/seller/SellerDashboard.tsx');

  assert.match(controller, /req\.headers\['idempotency-key'\]/);
  assert.match(controller, /Idempotency-Key header is required/);
  assert.match(service, /Idempotency-Key header is required/);
  assert.match(service, /WHERE seller_id = \$1\s+AND idempotency_key = \$2/);
  assert.doesNotMatch(service, /Math\.random\(\)/);
  assert.match(sellerApi, /idempotencyKey:\s*string/);
  assert.match(sellerApi, /Withdrawal idempotency key is required/);
  assert.doesNotMatch(sellerApi, /Math\.random\(\)/);
  assert.match(sellerDashboard, /withdrawalIdempotencyKeyRef/);
  assert.match(sellerDashboard, /idempotencyKey:\s*withdrawalIdempotencyKeyRef\.current/);
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
  const service = read('src/services/withdrawal.service.js');

  assert.match(callback, /WithdrawalService\.handleProviderCallback/);
  assert.match(service, /data\.client_reference \|\| data\.idempotency_key/);
  assert.match(service, /wr\.idempotency_key = \$2/);
  assert.match(service, /ppa\.idempotency_key = \$2/);
  assert.match(service, /updatePayoutProviderAttempt/);
  assert.match(service, /eventId:\s*`withdrawal\.\$\{finalStatus\}/);
});

test('payout callback amount rejection preserves non-terminal manual-review state', () => {
  const service = read('src/services/withdrawal.service.js');

  assert.match(service, /payout_callback_rejected/);
  assert.match(service, /callback_amount_rejected/);
  assert.match(service, /needs_manual_review/);
  assert.match(service, /AND status = 'processing'/);
  assert.doesNotMatch(service, /missing_valid_amount[\s\S]*updateStatusWithSideEffects\(request\.id, 'failed'/);
});

test('delayed payout success after refund enters compensation state without wallet mutation', () => {
  const callback = read('src/controllers/callback.controller.js');
  const service = read('src/services/withdrawal.service.js');
  const eventBus = read('src/events/eventBus.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(callback, /WithdrawalService\.handleProviderCallback/);
  assert.match(service, /FOR UPDATE OF wr/);
  assert.match(service, /isSuccess && request\.status === 'failed'/);
  assert.match(service, /recordProviderSuccessAfterRefundLocked/);
  assert.match(service, /async recordProviderSuccessAfterRefund/);
  assert.match(service, /PROVIDER_SUCCESS_AFTER_REFUND/);
  assert.match(service, /status = 'compensation_required'/);
  assert.match(service, /provider_success_after_refund/);
  assert.match(service, /freeze_payout_retries/);
  assert.match(service, /AppEvents\.WITHDRAWAL\.COMPENSATION_REQUIRED/);
  assert.match(eventBus, /COMPENSATION_REQUIRED:\s*'withdrawal\.compensation_required'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS payout_reconciliation_events/);
  assert.match(migration, /payout_reconciliation_events_unique_reference/);
  assert.doesNotMatch(callback, /updateStatusWithSideEffects\(request\.id,\s*'completed'/);
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

test('protected order creation requires checkout idempotency token', () => {
  const controller = read('src/controllers/order.controller.js');
  const service = read('src/services/order.service.js');

  assert.match(controller, /Checkout idempotency token is required/);
  assert.match(controller, /client_checkout_token:\s*checkoutToken\.trim\(\)\.slice\(0,\s*160\)/);
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
  const service = read('src/services/withdrawal.service.js');
  const migration = read('migrations/20260508020000_provider_callback_hardening.sql');

  assert.match(service, /matchedRequests\.length > 1/);
  assert.match(service, /PAYOUT_REFERENCE_AMBIGUOUS/);
  assert.match(service, /Ambiguous payout callback reference rejected before mutation/);
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
  const orderService = read('src/services/order.service.js');

  assert.match(orderService, /reserved_quantity = reserved_quantity - \$1/);
  assert.match(orderService, /AND reserved_quantity >= \$1/);
  assert.match(orderService, /Reserved inventory invariant failed/);
  assert.doesNotMatch(orderService, /reserved_quantity = GREATEST\(0, reserved_quantity - \$1\)/);
});

test('WhatsApp delivery suppresses duplicate notifications', () => {
  const whatsapp = read('src/services/whatsapp.service.js');

  assert.match(whatsapp, /recentMessageKeys/);
  assert.match(whatsapp, /Duplicate notification suppressed/);
  assert.match(whatsapp, /buildMessageKey\(jid,\s*message\)/);
});

test('buyer product grid uses React Query cache instead of local fetch effect churn', () => {
  const productGrid = read('../src/components/ProductGrid.tsx');

  assert.match(productGrid, /useQuery/);
  assert.match(productGrid, /queryKey:\s*\['public-products'/);
  assert.match(productGrid, /staleTime:\s*60_000/);
  assert.doesNotMatch(productGrid, /requestCache/);
  assert.doesNotMatch(productGrid, /fetchProducts/);
  assert.doesNotMatch(productGrid, /useEffect\(/);
});

test('seller dashboard summary uses React Query cache and avoids page reload refreshes', () => {
  const sellerDashboard = read('../src/components/seller/SellerDashboard.tsx');
  const productCard = read('../src/components/ProductCard.tsx');
  const adminDashboard = read('../src/pages/admin/NewDashboardPage.tsx');

  assert.match(sellerDashboard, /useQuery/);
  assert.match(sellerDashboard, /queryKey:\s*\['seller-dashboard', 'summary'\]/);
  assert.match(sellerDashboard, /staleTime:\s*60_000/);
  assert.match(sellerDashboard, /queryClient\.fetchQuery/);
  assert.match(sellerDashboard, /queryClient\.invalidateQueries/);
  assert.doesNotMatch(sellerDashboard, /window\.location\.reload/);
  assert.doesNotMatch(productCard, /Math\.random/);
  assert.doesNotMatch(adminDashboard, /Math\.random/);
  assert.doesNotMatch(adminDashboard, /window\.location\.reload/);
  assert.match(adminDashboard, /dashboardReloadToken/);
  assert.match(adminDashboard, /setDashboardReloadToken\(token => token \+ 1\)/);
  assert.match(adminDashboard, /inspectionSessionId/);
});

test('global auth revalidates on TTL expiry, route role change, focus, and visibility restore', () => {
  const authContext = read('../src/contexts/GlobalAuthContext.tsx');

  assert.match(authContext, /lastRouteRoleRef/);
  assert.match(authContext, /routeRoleChanged/);
  assert.match(authContext, /Date\.now\(\) - lastCheckRef\.current > AUTH_TTL/);
  assert.match(authContext, /window\.addEventListener\('focus', revalidateOnResume\)/);
  assert.match(authContext, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(authContext, /document\.visibilityState === 'visible'/);
  assert.match(authContext, /checkAuth\(true\)/);
  assert.match(authContext, /window\.removeEventListener\('focus', revalidateOnResume\)/);
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
  const completionRetry = read('src/cron/completionRetryCron.js');
  const orderDeadlineCron = read('src/cron/orderDeadlineCron.js');
  const shadowOrder = read('src/modules/orders/order.service.js');
  const paymentCron = read('src/cron/paymentCron.js');

  assert.match(completionRetry, /FulfillmentQueueService\.enqueue\(null,\s*orderId\)/);
  assert.match(completionRetry, /Deprecated shadow cron/);
  assert.doesNotMatch(completionRetry, /OrderService\.completeOrder/);
  assert.doesNotMatch(paymentCron, /legacy handlePaydCallback/);
  assert.doesNotMatch(paymentCron, /handlePaydCallback has an idempotency check/);
  assert.match(orderDeadlineCron, /OrderDeadlineService\.runAllChecks/);
  assert.doesNotMatch(orderDeadlineCron, /UPDATE product_orders[\s\S]*status = 'FAILED'/);
  assert.match(shadowOrder, /Deprecated modules\/orders service delegated/);
  assert.match(shadowOrder, /ActiveOrderService\.createOrder/);
  assert.match(shadowOrder, /ActiveOrderService\.updateOrderStatus/);
  assert.match(shadowOrder, /ActiveOrderService\.completeOrder/);
});
