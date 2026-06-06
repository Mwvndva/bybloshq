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

test('Paystack payment webhook fails closed and uses raw-body HMAC verification', () => {
  const controller = read('src/controllers/payment.controller.js');
  const core = read('src/core/CorePaymentService.js');
  const middleware = read('src/middleware/paystackWebhookSecurity.js');

  assert.match(controller, /CorePaymentService\.handlePaystackWebhook\(webhookData/);
  assert.match(controller, /hmacVerified:\s*req\.webhookSecurity\?\.hmacVerified === true/);
  assert.match(core, /verifyWebhookSignature\(security\.signature,\s*security\.rawBody\)/);
  assert.match(middleware, /req\.headers\['x-paystack-signature'\]/);
  assert.match(middleware, /verifyPaystackHmacSignature\(signature,\s*req\.rawBody\)/);
  assert.match(middleware, /getPaystackProviderReference\(root,\s*data\)/);
  assert.match(middleware, /Invalid webhook payload/);
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
  const core = read('src/core/CorePaymentService.js');
  const paystackNormalizer = read('src/shared/utils/paystackPaymentNormalizer.js');

  assert.match(paymentService, /source:\s*'status_polling'/);
  assert.match(paymentService, /source:\s*'payment_cron'/);
  assert.match(paymentService, /Legacy payment callback entrypoint is disabled/);
  assert.doesNotMatch(paymentService, /this\.handleSuccessfulPayment\(\{/);
  assert.doesNotMatch(paymentService, /amount:\s*paydStatus\.amount\s*\?\?\s*payment\.amount/);
  assert.doesNotMatch(paymentService, /amount:\s*providerData\?\.amount\s*\?\?\s*payment\.amount/);
  assert.match(paymentService, /Legacy payment success mutation is disabled/);
  assert.match(paymentService, /Legacy payment callback mutation is disabled/);
  assert.match(core, /normalizeReceiptForColumn\(extractReceipt\(providerPayload\)\)/);
  assert.match(paystackNormalizer, /mpesa_receipt:\s*details\.receipt_number \|\| root\.receipt_number \|\| null/);
  assert.doesNotMatch(paystackNormalizer, /mpesa_receipt:\s*details\.receipt_number \|\| details\.gateway_response/);
});

test('public order status polling resolves order numbers only and surfaces provider failures', () => {
  const publicController = read('src/controllers/public.controller.js');
  const publicOrderStatusRepository = read('src/repositories/publicOrderStatus.repository.js');
  const paymentModal = read('../src/components/PaymentStatusModal.tsx');
  const productCard = read('../src/components/ProductCard.tsx');

  assert.match(publicController, /publicOrderStatusRepository\.findStatusByIdentifier\(id\)/);
  assert.match(publicOrderStatusRepository, /po\.order_number = \$1/);
  assert.doesNotMatch(publicOrderStatusRepository, /OR\s+po\.id::text = \$1/);
  assert.match(publicController, /paymentService\.checkTransactionStatus\(reference\)/);
  assert.match(publicController, /CorePaymentService\.completeVerifiedPayment/);
  assert.match(publicController, /source:\s*'public_order_status_poll'/);
  assert.match(publicController, /PUBLIC_PAYMENT_STATUS_SYNC_INTERVAL_MS = 15000/);
  assert.match(publicController, /failureReason: extractPublicPaymentFailureReason\(order\)/);
  assert.match(productCard, /invoiceId:\s*String\(orderNumber \|\| orderId\)/);
  assert.match(paymentModal, /const isOrderPaid = \[[\s\S]*'PAID'[\s\S]*'FULFILLMENT_PENDING'[\s\S]*'FULFILLED'[\s\S]*'DELIVERED'[\s\S]*'COMPLETED'[\s\S]*'BOOKED'[\s\S]*'COLLECTION_PENDING'[\s\S]*\]\.includes\(orderStatus\)/);
  assert.match(paymentModal, /const isPaymentFailure = \['failed', 'cancelled', 'manual_review_required', 'payment_mapping_failed', 'compensation_required'\]/);
  assert.doesNotMatch(paymentModal, /!?\['PENDING', 'RESERVED'\]\.includes\(orderStatus\)/);
  assert.match(paymentModal, /insufficient balance, a wrong M-Pesa PIN, cancellation, or timeout/);
});

test('payment service selects configured payin provider and persists provider payment method', () => {
  const paymentService = read('src/services/payment.service.js');
  const paymentMethodMigration = read('migrations/20260510070000_allow_paystack_payment_method.sql');

  assert.match(paymentService, /process\.env\.PAYMENT_PROVIDER \|\| 'paystack'/);
  assert.match(paymentService, /this\.paymentProviderClient = new PaystackProviderClient\(\)/);
  assert.match(paymentService, /this\.providerClient = this\.paymentProviderClient/);
  assert.match(paymentService, /payment:\s*\{[\s\S]*method:\s*provider/);
  assert.match(paymentService, /payment_method:\s*provider/);
  assert.match(paymentService, /VALUES \(\$1, \$2, \$3, \$4, \$5, 'pending', \$6, \$7, \$8::jsonb\)/);
  assert.match(paymentMethodMigration, /to_regtype\('public\.payment_method'\)/);
  assert.match(paymentMethodMigration, /ALTER TYPE public\.payment_method ADD VALUE IF NOT EXISTS 'paystack'/);
});

test('withdrawal payouts route through configured provider after wallet deduction commit', () => {
  const payoutService = read('src/services/payout.service.js');
  const withdrawalService = read('src/services/withdrawal.service.js');

  assert.match(payoutService, /process\.env\.PAYOUT_PROVIDER \|\| 'paystack'/);
  assert.match(payoutService, /this\.provider = resolvePayoutProvider\(\)/);
  assert.match(payoutService, /this\.payoutProviderClient = this\._buildProviderClient\(this\.provider\)/);
  assert.match(payoutService, /if \(provider === 'paystack'\)[\s\S]*new PaystackTransferClient\(\)/);
  assert.match(payoutService, /this\.transferClient = this\.payoutProviderClient/);
  assert.match(payoutService, /this\.transferClient\.initiateTransfer/);
  assert.match(payoutService, /this\.transferClient\.verifyTransfer/);
  assert.match(withdrawalService, /UPDATE sellers[\s\S]*SET balance = balance - \$1,[\s\S]*withdrawal_reserved_balance = COALESCE\(withdrawal_reserved_balance, 0\) \+ \$1[\s\S]*INSERT INTO withdrawal_requests[\s\S]*await client\.query\('COMMIT'\)[\s\S]*this\._callProviderAndUpdate/);
  assert.match(payoutService, /UPDATE sellers[\s\S]*withdrawal_reserved_balance = GREATEST\(COALESCE\(withdrawal_reserved_balance, 0\) - \$1, 0\),[\s\S]*balance = COALESCE\(balance, 0\) \+ \$1/);
});

test('Paystack payout rollout adds only provider lookup indexes and preserves M-PESA wallet columns', () => {
  const migration = read('migrations/20260510060000_add_paystack_provider_lookup_indexes.sql');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const callbackStateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_payments_payment_method_status\s+ON payments\(payment_method,\s*status\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_method_status\s+ON withdrawal_requests\(\(metadata->>'provider'\),\s*status\)/);
  assert.doesNotMatch(migration, /ALTER TABLE\s+(payments|withdrawal_requests)/i);
  assert.doesNotMatch(migration, /RENAME COLUMN|DROP COLUMN/i);
  assert.match(withdrawalService, /mpesa_number,\s*mpesa_name/);
  assert.match(callbackStateMachine, /mpesa_receipt/);
});

test('admin payment labels are provider-neutral while raw provider payloads remain durable', () => {
  const adminDashboard = read('../src/pages/admin/NewDashboardPage.tsx');
  const adminApi = read('../src/api/adminApi.ts');
  const footer = read('../src/components/Footer.tsx');
  const productCard = read('../src/components/ProductCard.tsx');
  const adminController = read('src/controllers/admin.controller.js');
  const paymentModel = read('src/models/payment.model.js');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const fintechMigration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(adminDashboard, /Provider health/);
  assert.match(adminDashboard, /Payment provider balance\/status/);
  assert.match(adminDashboard, /Provider reference/);
  assert.match(adminApi, /getPaymentProviderBalances/);
  assert.match(adminController, /payment provider balance\/status/);
  assert.doesNotMatch(footer, />Payd</);
  assert.doesNotMatch(productCard, /Payd payments/);
  assert.match(paymentModel, /raw_response/);
  assert.match(withdrawalService, /SET provider_reference = \$1, raw_response = \$2/);
  assert.match(fintechMigration, /payment_provider_attempts[\s\S]*response_payload JSONB/);
  assert.match(fintechMigration, /payout_provider_attempts[\s\S]*response_payload JSONB/);
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
  const sellerWithdrawalsApi = read('../src/api/seller/withdrawalsApi.ts');
  const sellerWithdrawalsHook = read('../src/components/seller/dashboard/hooks/useSellerWithdrawals.ts');

  assert.match(controller, /req\.headers\['idempotency-key'\]/);
  assert.match(controller, /Idempotency-Key header is required/);
  assert.match(service, /Idempotency-Key header is required/);
  assert.match(service, /WHERE \$\{entityType === 'buyer_refund' \? 'buyer_id' : entityType === 'creator' \? 'creator_id' : 'seller_id'\} = \$1\s+AND idempotency_key = \$2/);
  assert.doesNotMatch(service, /Math\.random\(\)/);
  assert.match(sellerWithdrawalsApi, /idempotencyKey:\s*string/);
  assert.match(sellerWithdrawalsApi, /Withdrawal idempotency key is required/);
  assert.doesNotMatch(sellerWithdrawalsApi, /Math\.random\(\)/);
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
  const eventTypes = read('src/events/eventTypes.js');
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
  assert.match(eventTypes, /COMPENSATION_REQUIRED:\s*'withdrawal\.compensation_required'/);
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

test('EscrowManager remains isolated behind buyer confirmation release callers', () => {
  const services = filesUnder('src/services');
  const escrowImporters = services
    .filter(file => /from ['"]\.\/EscrowManager\.js['"]/.test(readFileSync(file, 'utf8')))
    .map(file => basename(file))
    .sort();

  const orderService = read('src/services/order.service.js');
  const ordersSectionUtils = read('../src/components/orders/ordersSectionUtils.tsx');
  const deadlineService = read('src/services/orderDeadline.service.js');
  const inventoryService = read('src/services/inventoryReservation.service.js');
  const fulfillmentTransition = read('src/services/orderFulfillmentTransition.service.js');
  const payoutCallbackStateMachine = read('src/services/payoutCallbackStateMachine.service.js');
  const escrowManager = read('src/services/EscrowManager.js');

  assert.deepEqual(escrowImporters, ['order.service.js', 'orderFulfillmentTransition.service.js']);
  assert.match(orderService, /escrowManager\.releaseFunds\(client,\s*order,\s*'OrderService'\)/);
  assert.doesNotMatch(deadlineService, /EscrowManager|escrowManager|releaseFunds/);
  assert.doesNotMatch(inventoryService, /EscrowManager|escrowManager|releaseFunds/);
  assert.match(fulfillmentTransition, /escrowManager\.releaseFunds\(client,\s*completedOrder,\s*'DigitalFulfillment'\)/);
  assert.doesNotMatch(payoutCallbackStateMachine, /EscrowManager|escrowManager|releaseFunds/);
  assert.match(orderService, /nonConfirmableStatuses/);
  assert.match(orderService, /deliveryStatus === 'delivered' \|\| deliveryStatus === 'completed'/);
  assert.doesNotMatch(orderService, /!canConfirmReceipt && order\.status === OrderStatus\.FULFILLING/);
  assert.match(escrowManager, /pending_settlement_balance = COALESCE\(pending_settlement_balance, 0\) \+ \$1/);
  assert.doesNotMatch(escrowManager, /SET balance = COALESCE\(balance, 0\)\s+\+\s+\$1/);
  assert.match(escrowManager, /orderStatus !== 'COMPLETED'/);
  assert.match(escrowManager, /reason: 'order_not_completed'/);
  assert.match(escrowManager, /RETURNING balance, pending_settlement_balance, net_revenue, total_sales/);
  assert.match(escrowManager, /Seller \$\{sellerId\} not found for escrow release/);
  assert.match(ordersSectionUtils, /terminalStatuses/);
  assert.match(ordersSectionUtils, /deliveryStatus === 'delivered' \|\| deliveryStatus === 'completed'/);
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
  assert.match(paymentService, /'TIMEOUT'/);
  assert.match(paymentService, /'CONNECTION_FAILED'/);
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
  assert.match(core, /manual_review_reason:\s*'amount_mismatch'/);
  assert.match(core, /status = 'manual_review_required'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS fraud_events/);
  assert.match(migration, /expected_amount/);
  assert.match(migration, /provider_amount/);
  assert.match(migration, /payload JSONB/);
});

test('Paystack production-switch regression plan protects payin, logistics, polling, and payout gates', () => {
  const fintechIntegration = read('test/fintech-remediation.integration.test.js');
  const criticalRegression = read('test/critical-systems.regression.test.js');
  const paymentEvents = read('src/events/payment.events.js');
  const logisticsService = read('src/services/logisticsRequest.service.js');
  const paymentService = read('src/services/payment.service.js');
  const payoutStateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(fintechIntegration, /Paystack accepted charge returns pending status/);
  assert.match(fintechIntegration, /payment webhook completes through one atomic transaction/);
  assert.match(fintechIntegration, /duplicate Paystack charge\.success does not duplicate fulfillment/);
  assert.match(criticalRegression, /Paystack amount mismatch blocks completion with fraud evidence and manual review/);
  assert.match(criticalRegression, /Paystack completion without order metadata is blocked before fulfillment/);
  assert.match(fintechIntegration, /pending Paystack charge is checked by status polling/);
  assert.match(fintechIntegration, /Paystack transfer success completes withdrawal/);
  assert.match(fintechIntegration, /Paystack transfer failure refunds seller wallet once/);
  assert.match(fintechIntegration, /Paystack transfer reversal after completion requires compensation without wallet mutation/);
  assert.match(paymentEvents, /AppEvents\.PAYMENT\.COMPLETED[\s\S]*activateDoorDeliveryAfterPayment/);
  assert.match(paymentEvents, /AppEvents\.PAYMENT\.COMPLETED[\s\S]*activateSellerPickupAfterPayment/);
  assert.match(logisticsService, /payment_not_completed/);
  assert.match(paymentService, /this\.paymentProviderClient = new PaystackProviderClient\(\)/);
  assert.match(payoutStateMachine, /providerPayloadIndicatesReversal/);
});

test('external notification side effects are emitted through EventBus from critical services', () => {
  const orderService = read('src/services/order.service.js');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const fulfillmentQueue = read('src/services/fulfillmentQueue.service.js');
  const adminController = read('src/controllers/admin.controller.js');
  const refundController = read('src/controllers/refund.controller.js');
  const buyerController = read('src/controllers/buyer.controller.js');
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
  assert.match(refundController, /Manual refund payout confirmation is disabled/);
  assert.match(buyerController, /WithdrawalService\.createWithdrawalRequest\(\{[\s\S]*entityType:\s*'buyer_refund'/);
  assert.match(refundController, /AppEvents\.REFUND\.REJECTED/);
  assert.match(referralService, /AppEvents\.REFERRAL\.REWARD_CREATED/);
  assert.match(events, /notifyBuyerDigitalDelivery/);
  assert.match(events, /notifySellerWithdrawalUpdate/);
  assert.doesNotMatch(events, /Event:OrderFulfilled[\s\S]*notifySellerNewOrder/);
});

test('EventBus uses durable event-id dedupe for multi-instance notification suppression', () => {
  const eventBus = read('src/events/eventBus.js');
  const outboxRepository = read('src/events/outboxRepository.js');
  const eventDispatcher = read('src/events/eventDispatcher.js');
  const loader = read('src/loaders/services.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(outboxRepository, /INSERT INTO event_dedupe/);
  assert.match(outboxRepository, /INSERT INTO event_outbox/);
  assert.match(eventBus, /enqueueInTransaction/);
  assert.match(eventBus, /dispatchOutboxEvent/);
  assert.match(outboxRepository, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.match(eventBus, /replayPendingOutbox/);
  assert.match(outboxRepository, /FOR UPDATE SKIP LOCKED/);
  assert.match(eventDispatcher, /replayPendingOutbox/);
  assert.match(outboxRepository, /deferring side-effect event until outbox claim succeeds/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_dedupe/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_outbox/);
  assert.match(migration, /idx_event_outbox_retry/);
  assert.match(loader, /eventBus\.replayPendingOutbox/);
});

test('important post-commit lifecycle events prefer durable outbox rows', () => {
  const eventBus = read('src/events/eventBus.js');
  const orderService = read('src/services/order.service.js');
  const orderCancellationService = read('src/services/orderCancellation.service.js');
  const withdrawalService = read('src/services/withdrawal.service.js');
  const payoutStateMachine = read('src/services/payoutCallbackStateMachine.service.js');
  const refundController = read('src/controllers/refund.controller.js');
  const buyerController = read('src/controllers/buyer.controller.js');
  const adminController = read('src/controllers/admin.controller.js');
  const referralService = read('src/services/referral.service.js');
  const coreOrder = read('src/core/CoreOrderService.js');

  assert.match(eventBus, /async enqueue\(event, payload = \{\}\)/);
  assert.match(eventBus, /dispatchAfterCommit\(eventId/);
  assert.match(eventBus, /async enqueueAndDispatch\(event, payload = \{\}, context = 'EventBus'\)/);

  assert.match(orderService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.CREATED/);
  assert.match(orderCancellationService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.CANCELLED/);
  assert.match(orderService, /enqueueInTransaction\(client,\s*AppEvents\.ORDER\.PAID/);
  assert.match(orderService, /enqueueAndDispatch\(AppEvents\.ORDER\.UPDATED/);
  assert.match(withdrawalService, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.CREATED/);
  assert.match(withdrawalService, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.UPDATED/);
  assert.match(payoutStateMachine, /enqueueInTransaction\(\s*client,\s*AppEvents\.WITHDRAWAL\.COMPENSATION_REQUIRED/);
  assert.match(refundController, /Manual refund payout confirmation is disabled/);
  assert.match(buyerController, /WithdrawalService\.createWithdrawalRequest\(\{[\s\S]*entityType:\s*'buyer_refund'/);
  assert.match(refundController, /enqueueAndDispatch\(AppEvents\.REFUND\.REJECTED/);
  assert.match(adminController, /enqueueInTransaction\(client,\s*AppEvents\.WITHDRAWAL\.UPDATED/);
  assert.match(referralService, /enqueueInTransaction\(client,\s*AppEvents\.REFERRAL\.REWARD_CREATED/);
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

  assert.deepEqual(directEmitSites, []);
});

test('EventBus outbox only completes after listener delivery succeeds', () => {
  const eventBus = read('src/events/eventBus.js');
  const eventDispatcher = read('src/events/eventDispatcher.js');
  const outboxRepository = read('src/events/outboxRepository.js');
  const orderEvents = read('src/events/order.events.js');
  const paymentEvents = read('src/events/payment.events.js');
  const migration = read('migrations/20260507231000_final_fintech_stabilization.sql');

  assert.match(eventBus, /classifyDeliveryError/);
  assert.match(outboxRepository, /delivery_attempts/);
  assert.match(outboxRepository, /permanently_failed/);
  assert.match(eventDispatcher, /transient_delivery_failure/);
  assert.match(outboxRepository, /last_error_type/);
  assert.match(orderEvents, /async function deliverAll/);
  assert.match(orderEvents, /Promise\.allSettled/);
  assert.doesNotMatch(orderEvents, /whatsappService\.[\s\S]*\.catch\(/);
  assert.doesNotMatch(paymentEvents, /whatsappService\.[\s\S]*\.catch\(/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS delivery_attempts/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS final_failure_at/);
});

test('payout callbacks require HMAC, timestamp, and replay protection before mutation', () => {
  const route = read('src/routes/callback.routes.js');
  const middleware = read('src/middleware/paystackWebhookSecurity.js');
  const callback = read('src/controllers/callback.controller.js');
  const migration = read('migrations/20260508010000_webhook_replay_and_notification_delivery.sql');
  const hardeningMigration = read('migrations/20260508020000_provider_callback_hardening.sql');

  assert.match(route, /requirePaystackWebhookHmac/);
  assert.match(route, /verifyPaystackWebhook,[\s\S]*webhookRateLimiter,[\s\S]*requirePaystackWebhookHmac,[\s\S]*handlePaystackTransferCallback/);
  assert.match(middleware, /verifyPaystackHmacSignature/);
  assert.match(middleware, /x-paystack-signature/);
  assert.match(middleware, /PAYSTACK_WEBHOOK_IPS/);
  assert.match(middleware, /webhook_replay_dedupe/);
  assert.match(middleware, /Webhook already processed/);
  assert.match(middleware, /Webhook already processing/);
  assert.match(callback, /req\.webhookSecurity\?\.hmacVerified/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS webhook_replay_dedupe/);
  assert.match(hardeningMigration, /ADD COLUMN IF NOT EXISTS status/);
});

test('Paystack transfer callbacks map terminal events through payout state machine only', () => {
  const route = read('src/routes/callback.routes.js');
  const controller = read('src/controllers/callback.controller.js');
  const normalizer = read('src/shared/utils/paystackTransferNormalizer.js');
  const stateMachine = read('src/services/payoutCallbackStateMachine.service.js');

  assert.match(route, /router\.post\(\s*'\/paystack-transfer'/);
  assert.match(controller, /normalizePaystackTransferPayload\(req\.body\)/);
  assert.match(controller, /PayoutCallbackStateMachineService\.handleProviderCallback\(data/);
  assert.doesNotMatch(controller, /refundToWallet|UPDATE\s+sellers|UPDATE\s+withdrawal_requests/i);
  assert.match(normalizer, /event === 'transfer\.success'[\s\S]*'success'/);
  assert.match(normalizer, /event === 'transfer\.failed' \|\| event === 'transfer\.reversed'[\s\S]*'failed'/);
  assert.match(stateMachine, /providerPayloadIndicatesReversal/);
  assert.match(stateMachine, /isReversal && request\.status === 'completed'/);
  assert.match(stateMachine, /recordProviderReversalAfterCompletionLocked/);
  assert.match(stateMachine, /PROVIDER_REVERSAL_AFTER_COMPLETION/);
  assert.match(stateMachine, /provider_reversal_after_completion/);
  assert.match(stateMachine, /if \(!isSuccess\)[\s\S]*payoutService\.refundToWallet\(client,\s*request\)/);
});

test('single Paystack dashboard webhook route dispatches charge and transfer events internally', () => {
  const routeIndex = read('src/routes/index.js');
  const unifiedRoute = read('src/routes/webhook.routes.js');
  const controller = read('src/controllers/paystackWebhook.controller.js');
  const expressLoader = read('src/loaders/express.js');
  const dockerCompose = read('../docker-compose.yml');
  const envExample = read('.env.production.example');
  const readme = read('../README.md');

  assert.match(routeIndex, /import webhookRoutes from '\.\/webhook\.routes\.js'/);
  assert.match(routeIndex, /router\.use\('\/webhooks', webhookRoutes\)/);
  assert.match(unifiedRoute, /router\.post\(\s*'\/paystack'/);
  assert.match(unifiedRoute, /verifyPaystackWebhook,[\s\S]*webhookRateLimiter,[\s\S]*requirePaystackWebhookHmac,[\s\S]*handleUnifiedPaystackWebhook/);
  assert.match(controller, /CHARGE_EVENTS[\s\S]*'charge\.success'/);
  assert.match(controller, /TRANSFER_EVENTS[\s\S]*'transfer\.success'/);
  assert.match(controller, /paymentController\.handlePaystackWebhook\(req,\s*res,\s*next\)/);
  assert.match(controller, /handlePaystackTransferCallback\(req,\s*res,\s*next\)/);
  assert.match(controller, /ignored:\s*true/);
  assert.match(expressLoader, /req\.path\.startsWith\('\/api\/webhooks\/'\)/);
  assert.match(dockerCompose, /PAYSTACK_WEBHOOK_URL:\s*\$\{PAYSTACK_WEBHOOK_URL:-https:\/\/bybloshq\.space\/api\/webhooks\/paystack\}/);
  assert.match(envExample, /PAYSTACK_WEBHOOK_URL=https:\/\/bybloshq\.space\/api\/webhooks\/paystack/);
  assert.match(readme, /PAYSTACK_WEBHOOK_URL=https:\/\/bybloshq\.space\/api\/webhooks\/paystack/);
});

test('payment webhook route also requires HMAC and replay protection', () => {
  const route = read('src/routes/payment.routes.js');

  assert.match(route, /requirePaystackWebhookHmac/);
  assert.match(route, /verifyPaystackWebhook,[\s\S]*webhookRateLimiter,[\s\S]*requirePaystackWebhookHmac,[\s\S]*paymentController\.handlePaystackWebhook/);
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
  const eventTypes = read('src/events/eventTypes.js');
  const eventDispatcher = read('src/events/eventDispatcher.js');

  assert.match(index, /await import\('\.\/events\/order\.events\.js'\)/);
  assert.match(index, /await eventBus\.verifyRequiredListeners\(\)/);
  assert.match(index, /await loaders\(app\)/);
  assert.match(eventTypes, /CriticalEvents = new Set/);
  assert.match(eventDispatcher, /Critical event \$\{event\} has no registered listeners/);
  assert.match(eventBus, /verifyRequiredListeners/);
});

test('notification retries are tracked per recipient to avoid duplicate partial deliveries', () => {
  const eventBus = read('src/events/eventBus.js');
  const recipientDelivery = read('src/events/recipientDelivery.js');
  const orderEvents = read('src/events/order.events.js');
  const paymentEvents = read('src/events/payment.events.js');
  const migration = read('migrations/20260508010000_webhook_replay_and_notification_delivery.sql');

  assert.match(eventBus, /deliverRecipient/);
  assert.match(recipientDelivery, /event_recipient_deliveries/);
  assert.match(recipientDelivery, /Recipient delivery already completed; suppressing duplicate/);
  assert.match(orderEvents, /eventBus\.deliverRecipient/);
  assert.match(paymentEvents, /eventBus\.deliverRecipient/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_recipient_deliveries/);
  assert.match(migration, /event_recipient_deliveries_unique/);
});

test('successful product payments send buyer order confirmation and unique receipt emails once', () => {
  const core = read('src/core/CorePaymentService.js');
  const paymentEvents = read('src/events/payment.events.js');
  const receiptService = read('src/services/paymentReceipt.service.js');
  const emailUtils = read('src/shared/utils/email.js');
  const receiptTemplate = read('email-templates/product-payment-receipt.ejs');

  assert.match(core, /receipt_id:\s*buildPaymentReceiptId\(paymentRow\)/);
  assert.match(paymentEvents, /PaymentReceiptService\.sendBuyerEmailsAfterPayment/);
  assert.match(receiptService, /sendProductOrderConfirmationEmail/);
  assert.match(receiptService, /sendPaymentReceiptEmail/);
  assert.match(receiptService, /payment:\$\{payment\.id\}:buyer:order_confirmation/);
  assert.match(receiptService, /payment:\$\{payment\.id\}:buyer:payment_receipt/);
  assert.match(receiptService, /Door delivery fee/);
  assert.match(receiptService, /Byblos service charge/);
  assert.match(receiptService, /buyer_service_charge/);
  assert.match(receiptService, /sendSellerPickupReceiptAfterPayment/);
  assert.match(receiptService, /payment:\$\{payment\.id\}:seller:pickup_receipt/);
  assert.match(paymentEvents, /PaymentReceiptService\.sendSellerPickupReceiptAfterPayment/);
  assert.match(receiptService, /channel:\s*'email'/);
  assert.match(emailUtils, /receiptId/);
  assert.match(emailUtils, /confirmationNote/);
  assert.match(receiptTemplate, /Receipt ID/);
});

test('email templates resolve from docker root and order WhatsApp events use normalized contacts', () => {
  const emailUtils = read('src/shared/utils/email.js');
  const orderEvents = read('src/events/order.events.js');
  const whatsappService = read('src/services/whatsapp.service.js');

  assert.match(emailUtils, /\.\.\/\.\.\/\.\.\/email-templates/);
  assert.match(emailUtils, /Email template not found/);
  assert.match(orderEvents, /OrderReadService\.getStatusNotificationDetails/);
  assert.match(orderEvents, /OrderNotificationPayloadService\.prepareNormalizedNotificationPayload/);
  assert.match(orderEvents, /WhatsApp waits for payment completion/);
  assert.doesNotMatch(orderEvents, /notifySellerNewOrder|notifyBuyerOrderConfirmation/);
  assert.doesNotMatch(whatsappService, /async notifySellerNewOrder|async notifyBuyerOrderConfirmation/);
  assert.match(whatsappService, /async notifyBuyerPaymentSuccess/);
  assert.match(whatsappService, /async notifyBuyerDigitalDelivery/);
  assert.match(whatsappService, /async notifyCourierNewOrder/);
});

test('EventBus defers side effects when outbox claim DB is unavailable', () => {
  const eventBus = read('src/events/eventBus.js');
  const outboxRepository = read('src/events/outboxRepository.js');

  assert.match(eventBus, /pendingClaimRetries/);
  assert.match(eventBus, /scheduleClaimRetry/);
  assert.match(eventBus, /flushPendingClaimRetries/);
  assert.match(outboxRepository, /reason:\s*'db_unavailable'/);
  assert.match(outboxRepository, /deferring side-effect event until outbox claim succeeds/);
  assert.match(eventBus, /claim\?\.claimed === false/);
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

test('logistics migrations backfill required runtime columns and prune unused columns', () => {
  const baseMigration = read('migrations/20260510010000_add_logistics_data_model.sql');
  const hardeningMigration = read('migrations/20260512180000_harden_logistics_required_columns.sql');
  const schemaCheck = read('src/loaders/schemaCheck.js');

  assert.doesNotMatch(baseMigration, /contact_name/);
  assert.match(hardeningMigration, /DROP COLUMN IF EXISTS contact_name/);
  assert.match(hardeningMigration, /INSERT INTO logistics_partners \(name, slug, active, metadata, created_at, updated_at\)/);
  assert.match(hardeningMigration, /ALTER COLUMN name SET NOT NULL/);
  assert.match(hardeningMigration, /ALTER COLUMN slug SET NOT NULL/);
  assert.match(hardeningMigration, /ALTER COLUMN status SET DEFAULT 'pending'/);
  assert.match(hardeningMigration, /ALTER COLUMN service_level SET DEFAULT 'standard'/);
  assert.match(hardeningMigration, /ALTER COLUMN fee_amount SET DEFAULT 0/);
  assert.match(hardeningMigration, /ALTER COLUMN fee_currency SET DEFAULT 'KES'/);
  assert.match(hardeningMigration, /ALTER COLUMN source SET DEFAULT 'system'/);
  assert.match(hardeningMigration, /ALTER COLUMN active SET DEFAULT TRUE/);
  assert.match(hardeningMigration, /RAISE EXCEPTION 'logistics_requests has rows missing required order_id or partner_id'/);
  assert.match(hardeningMigration, /RAISE EXCEPTION 'logistics_legs has rows missing required request, leg_type, or payer'/);
  assert.match(schemaCheck, /package_code/);
  assert.match(schemaCheck, /service_level/);
  assert.match(schemaCheck, /origin_address/);
  assert.match(schemaCheck, /destination_address/);
  assert.match(schemaCheck, /actor_label/);
  assert.match(schemaCheck, /expires_at/);
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

test('door delivery payment totals are recalculated by backend and do not inflate seller payout', () => {
  const paymentRoutes = read('src/routes/payment.routes.js');
  const paymentController = read('src/controllers/payment.controller.js');
  const core = read('src/core/CorePaymentService.js');
  const paymentService = read('src/services/payment.service.js');
  const paymentEvents = read('src/events/payment.events.js');
  const logisticsRequestService = read('src/services/logisticsRequest.service.js');
  const quoteService = read('src/services/logisticsQuote.service.js');
  const orderModel = read('src/models/order.model.js');
  const orderService = read('src/services/order.service.js');
  const sanitize = read('src/shared/utils/sanitize.js');
  const logisticsStatusMigration = read('migrations/20260510020000_add_delivery_pending_logistics_status.sql');
  const productCard = read('../src/components/ProductCard.tsx');
  const phoneModal = read('../src/components/PhoneCheckModal.tsx');
  const buyerOrderCard = read('../src/components/orders/BuyerOrderCard.tsx');
  const sellerOrdersSection = read('../src/components/seller/SellerOrdersSection.tsx');
  const orderLogisticsTracking = read('../src/components/orders/OrderLogisticsTracking.tsx');

  assert.match(paymentRoutes, /\/logistics-quote/);
  assert.match(paymentController, /LogisticsQuoteService\.quoteBuyerDoorDelivery\(location\)/);
  assert.match(quoteService, /Math\.ceil\(distance\)\s*\*\s*rate/);
  assert.match(paymentService, /assertDoorDeliveryLocation\(buyerDeliveryLocation\)/);
  assert.match(paymentService, /LogisticsQuoteService\.quoteBuyerDoorDelivery\(buyerDeliveryLocation\)/);
  assert.match(paymentService, /PRODUCT_SERVICE_CHARGE_RATE\s*=\s*Fees\.PRODUCT_SERVICE_CHARGE_RATE/);
  assert.match(read('src/config/fees.js'), /PRODUCT_SERVICE_CHARGE_RATE:\s*0\.02/);
  assert.match(read('src/config/fees.js'), /PLATFORM_COMMISSION_AMOUNT:\s*10/);
  assert.match(paymentService, /roundPayableTotal\s*=\s*\(amount\)\s*=>\s*Math\.ceil\(roundMoney\(amount\)\)/);
  assert.match(paymentService, /paymentBaseTotal\s*=\s*roundMoney\(productSubtotal \+ buyerDeliveryFee\)/);
  assert.match(paymentService, /productServiceCharge\s*=\s*calculateProductServiceCharge\(productSubtotal\)/);
  assert.match(paymentService, /payableTotal\s*=\s*roundPayableTotal\(paymentBaseTotal \+ productServiceCharge\)/);
  assert.match(paymentService, /buyer_service_charge:\s*productServiceCharge/);
  assert.match(paymentService, /amount:\s*payableTotal/);
  assert.match(paymentService, /service:\s*\{[\s\S]*total:\s*payableTotal/);
  assert.match(paymentService, /price:\s*dbPrice/);
  assert.match(paymentService, /subtotal:\s*productSubtotal/);
  assert.match(paymentService, /seller_payout_base:\s*productSubtotal/);
  assert.match(paymentService, /seller_payout_excludes_delivery_fee:\s*true/);
  assert.match(orderService, /let \{ totalAmount, platformFee, sellerPayout \} = this\._calculateTotals\(items\)/);
  assert.match(orderService, /total_amount:\s*payableTotal/);
  assert.match(orderService, /seller_payout_amount:\s*sellerPayout/);
  assert.match(paymentService, /LogisticsRequestService\.createDoorDeliveryPaymentPending\(client/);
  assert.match(paymentService, /LogisticsRequestService\.createDoorDeliveryPaymentPending\(client[\s\S]*await this\.createPaymentProviderAttempt\(client[\s\S]*await client\.query\('COMMIT'\)[\s\S]*await this\.initiatePayment\(gwPayload\)/);
  assert.match(paymentService, /cancelPaymentPendingLegsForPaymentFailure/);
  assert.match(logisticsRequestService, /INSERT INTO logistics_requests[\s\S]*'payment_pending'/);
  assert.match(logisticsRequestService, /INSERT INTO logistics_legs[\s\S]*'delivery', 'buyer', 'payment_pending'/);
  assert.match(logisticsRequestService, /INSERT INTO logistics_tracking_events/);
  assert.doesNotMatch(logisticsRequestService, /whatsapp|sendLogisticsNotification/);
  assert.match(logisticsRequestService, /AppEvents\.LOGISTICS\.NOTIFICATION/);
  assert.match(paymentEvents, /AppEvents\.PAYMENT\.COMPLETED/);
  assert.match(paymentEvents, /LogisticsRequestService\.activateDoorDeliveryAfterPayment/);
  assert.match(logisticsRequestService, /status = 'delivery_pending'/);
  assert.match(logisticsRequestService, /status = 'active'/);
  assert.match(logisticsRequestService, /Buyer paid for door delivery/);
  assert.match(core, /handlePaystackWebhook\(webhookData/);
  assert.match(core, /return this\.completeVerifiedPayment\(/);
  assert.match(core, /eventBus\.enqueueInTransaction\([\s\S]*AppEvents\.PAYMENT\.COMPLETED/);
  assert.doesNotMatch(paymentController, /LogisticsRequestService|logistics_legs|activateDoorDeliveryAfterPayment/);
  assert.doesNotMatch(core, /LogisticsRequestService|logistics_legs|activateDoorDeliveryAfterPayment/);
  assert.match(logisticsStatusMigration, /'delivery_pending'/);
  assert.match(orderModel, /AS logistics/);
  assert.match(sanitize, /sanitizeLogistics/);
  assert.match(buyerOrderCard, /OrderLogisticsTracking/);
  assert.match(sellerOrdersSection, /OrderLogisticsTracking/);
  assert.match(orderLogisticsTracking, /Door delivery tracking/);
  assert.match(productCard, /deliveryMode:\s*'DOOR_DELIVERY'/);
  assert.match(phoneModal, /Mzigo Ego handles your package securely, checks it against the order, and delivers within 24 hours/);
  assert.doesNotMatch(paymentService, /buyerDeliveryFee\s*=\s*deliveryRequest\.frontendQuote/);
});

test('seller pickup fee payment activates pickup logistics without mutating product payment state', () => {
  const sellerRoutes = read('src/routes/seller.routes.js');
  const orderController = read('src/controllers/order.controller.js');
  const paymentService = read('src/services/payment.service.js');
  const core = read('src/core/CorePaymentService.js');
  const paymentEvents = read('src/events/payment.events.js');
  const logisticsRequestService = read('src/services/logisticsRequest.service.js');
  const orderModel = read('src/models/order.model.js');
  const sanitize = read('src/shared/utils/sanitize.js');
  const sellerOrdersApi = read('../src/api/seller/ordersApi.ts');
  const sellerOrdersSection = read('../src/components/seller/SellerOrdersSection.tsx');
  const buyerOrderCard = read('../src/components/orders/BuyerOrderCard.tsx');
  const orderLogisticsTracking = read('../src/components/orders/OrderLogisticsTracking.tsx');

  assert.match(sellerRoutes, /\/orders\/:id\/request-pickup/);
  assert.match(orderController, /requestSellerPickup/);
  assert.match(orderController, /initiateSellerPickupPayment/);
  assert.match(paymentService, /LogisticsQuoteService\.quoteSellerPickup\(pickup\)/);
  assert.match(paymentService, /const provider = this\.provider/);
  assert.match(paymentService, /INSERT INTO payments[\s\S]*payment_method[\s\S]*VALUES \(\$1, \$2, \$3, \$4, \$5, 'pending', \$6, \$7, \$8::jsonb\)/);
  assert.match(paymentService, /payment_method:\s*provider/);
  assert.match(paymentService, /payment_purpose:\s*'seller_pickup_fee'/);
  assert.match(paymentService, /logistics_payment_type:\s*'seller_pickup_fee'/);
  assert.match(paymentService, /p\.product_type::text/);
  assert.doesNotMatch(paymentService, /COALESCE\(oi\.metadata->>'productType', p\.product_type, 'physical'\)/);
  assert.match(paymentService, /LogisticsRequestService\.createSellerPickupPaymentPending/);
  assert.match(paymentService, /markLogisticsPaymentInitiationFailed/);
  assert.match(paymentService, /orderId && !isSellerPickupFeePayment/);
  assert.match(core, /isSellerPickupFeePayment/);
  assert.match(core, /Completed logistics fee payment without mutating order payment or fulfillment state/);
  assert.match(paymentEvents, /activateSellerPickupAfterPayment/);
  assert.match(logisticsRequestService, /INSERT INTO logistics_legs[\s\S]*'pickup', 'seller', 'payment_pending'/);
  assert.match(logisticsRequestService, /status = 'pending'/);
  assert.match(logisticsRequestService, /Seller paid for pickup/);
  assert.match(logisticsRequestService, /AppEvents\.LOGISTICS\.NOTIFICATION/);
  assert.match(orderModel, /'pickupLeg'/);
  assert.match(sanitize, /pickupLeg:\s*sanitizeLeg/);
  assert.match(sellerOrdersApi, /requestPickup/);
  assert.match(sellerOrdersSection, /Request Mzigo pickup/);
  assert.match(sellerOrdersSection, /const isPhysicalOrder = !isService && !isDigital/);
  assert.match(sellerOrdersSection, /const canRequestPickup = isPhysicalOnline/);
  assert.match(sellerOrdersSection, /After the pickup fee is paid, Mzigo Ego collects the package, secures it, and checks it against the order before delivery/);
  assert.match(sellerOrdersSection, /Drop the package at Mzigo Ego within 24 hours/);
  assert.match(buyerOrderCard, /OrderLogisticsTracking/);
  assert.match(orderLogisticsTracking, /Seller pickup/);
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
  const sellerWithdrawalsApi = read('../src/api/seller/withdrawalsApi.ts');

  assert.match(expressLoader, /'Idempotency-Key'/);
  assert.match(expressLoader, /'X-Checkout-Token'/);
  assert.match(expressLoader, /'X-Idempotency-Key'/);
  assert.match(expressLoader, /'X-Request-Id'/);
  assert.match(productCard, /'Idempotency-Key': checkoutToken/);
  assert.match(buyerApi, /'Idempotency-Key': idempotencyKey/);
  assert.match(sellerWithdrawalsApi, /'Idempotency-Key': data\.idempotencyKey/);
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
  assert.match(transitionService, /assertValidTransition\(currentOrder\.status,\s*OrderStatus\.AWAITING_SELLER_ACTION/);
  assert.match(transitionService, /assertValidTransition\(order\.status,\s*OrderStatus\.AWAITING_SELLER_ACTION/);
  assert.match(transitionService, /assertValidTransition\(order\.status,\s*OrderStatus\.FULFILLING/);
  assert.match(transitionService, /assertValidTransition\(OrderStatus\.FULFILLING,\s*OrderStatus\.COMPLETED/);
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
  const orderCancellationService = read('src/services/orderCancellation.service.js');
  const reservationRelease = read('src/shared/utils/reservationRelease.js');
  const inventoryService = read('src/services/inventoryReservation.service.js');
  const transitionService = read('src/services/orderFulfillmentTransition.service.js');

  assert.match(orderService, /InventoryReservationService\.enrichItemsWithProductData\(client,\s*items\)/);
  assert.match(orderService, /InventoryReservationService\.checkInventory\(items\)/);
  assert.match(orderService, /InventoryReservationService\.reserveInventory\(client,\s*items\)/);
  assert.match(orderCancellationService, /InventoryReservationService\.releaseOrderInventory\(client,\s*orderId\)/);
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
  const sellerAnalyticsRepository = read('src/repositories/sellerAnalytics.repository.js');
  const paymentService = read('src/services/payment.service.js');
  const productCard = read('../src/components/ProductCard.tsx');
  const adminDashboard = read('../src/pages/admin/NewDashboardPage.tsx');

  assert.match(sellerDashboard, /useSellerDashboardData/);
  assert.match(sellerDashboardDataHook, /useQuery/);
  assert.match(sellerDashboardQueryKeys, /products:\s*\['seller-dashboard', 'products'\]/);
  assert.match(sellerDashboardQueryKeys, /analytics:\s*\['seller-dashboard', 'analytics'\]/);
  assert.match(sellerDashboardDataHook, /staleTime:\s*60_000/);
  assert.match(sellerDashboardDataHook, /queryClient\.fetchQuery/);
  assert.match(sellerDashboardDataHook, /queryClient\.invalidateQueries/);
  assert.match(sellerAnalyticsRepository, /JOIN payouts p[\s\S]*p\.order_id = o\.id[\s\S]*p\.settlement_status IN/);
  assert.match(sellerAnalyticsRepository, /COALESCE\(p\.completed_at, p\.processed_at, o\.updated_at, o\.created_at\)/);
  assert.match(sellerAnalyticsRepository, /metadata->'creator_attribution'->>'creator_id'/);
  assert.match(sellerAnalyticsRepository, /metadata->'creator_attribution'->>'commission_amount'/);
  assert.doesNotMatch(sellerAnalyticsRepository, /COALESCE\(o\.metadata, '\{\}'::jsonb\) \? 'creator_attribution'/);
  assert.match(paymentService, /\.\.\.\(creatorAttribution \? \{ creator_attribution: creatorAttribution \} : \{\}\)/);
  assert.doesNotMatch(sellerAnalyticsRepository, /COALESCE\(SUM\(o\.total_amount\), 0\) as total_sales[\s\S]{0,120}WHERE o\.seller_id = s\.id[\s\S]{0,80}AND o\.payment_status = 'completed'/);
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
  const authRevalidation = read('../src/contexts/auth/useAuthRevalidation.ts');
  const authRouting = read('../src/contexts/auth/authRouting.ts');
  const globalAuthContext = read('../src/contexts/GlobalAuthContext.tsx');
  const buyerAuthContext = read('../src/contexts/BuyerAuthContext.tsx');
  const sellerAuthContext = read('../src/contexts/SellerAuthContext.tsx');
  const adminAuthContext = read('../src/contexts/AdminAuthContext.tsx');

  assert.match(authContext, /useAuthRevalidation/);
  assert.match(authRevalidation, /lastRouteRoleRef/);
  assert.match(authRevalidation, /routeRoleChanged/);
  assert.match(authRouting, /AUTH_REVALIDATION_TTL_MS\s*=\s*5 \* 60 \* 1000/);
  assert.match(authRevalidation, /Date\.now\(\) - lastCheckRef\.current > AUTH_REVALIDATION_TTL_MS/);
  assert.match(authRevalidation, /window\.addEventListener\('focus', revalidateOnResume\)/);
  assert.match(authRevalidation, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(authRevalidation, /document\.visibilityState === 'visible'/);
  assert.match(authRevalidation, /checkAuth\(true\)/);
  assert.match(authRevalidation, /window\.removeEventListener\('focus', revalidateOnResume\)/);
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
  const publicCatalogRepository = read('src/repositories/publicCatalog.repository.js');
  const sellerRepository = read('src/repositories/seller.repository.js');

  assert.match(publicCatalogRepository, /ORDER BY p\.created_at DESC, p\.id DESC LIMIT/);
  assert.match(sellerRepository, /ORDER BY total_wishlist_count DESC, s\.id ASC/);
  assert.match(publicCatalogRepository, /ORDER BY time_slot ASC, id ASC/);
});

test('webhook rate limiting protects requests with local fallback', () => {
  const middleware = read('src/middleware/paystackWebhookSecurity.js');

  assert.match(middleware, /const requests = new Map\(\)/);
  assert.match(middleware, /MAX_REQUESTS = 100/);
  assert.match(middleware, /Too many webhook requests/);
  assert.match(middleware, /PAYSTACK_WEBHOOK_IPS/);
});

test('Mzigo logistics dashboard is protected, partner-scoped, and read-only for money state', () => {
  const service = read('src/services/logisticsDashboard.service.js');
  const middleware = read('src/middleware/logisticsAuth.js');
  const routes = read('src/routes/logistics.routes.js');
  const routeIndex = read('src/routes/index.js');
  const logisticsEvents = read('src/events/logistics.events.js');
  const trackingService = read('src/services/logisticsTrackingLink.service.js');
  const migration = read('migrations/20260510030000_add_logistics_dashboard_auth.sql');
  const roleConstraintMigration = read('migrations/20260510050000_allow_logistics_user_role.sql');
  const frontendRoutes = read('../src/routes/index.tsx');
  const frontendApi = read('../src/api/logisticsApi.ts');
  const frontendDashboard = read('../src/pages/logistics/MzigoDashboardPage.tsx');

  const requestReadMethod = service.slice(service.indexOf('static async getDashboardRequests'));
  const readyForBuyerHelper = service.slice(
    service.indexOf('async function markOrderReadyForBuyerAfterDeliveredLeg'),
    service.indexOf('const ADMIN_LOGISTICS_STATUS_FILTERS')
  );

  assert.match(migration, /VALUES \('Logistics', 'logistics'\)/);
  assert.doesNotMatch(migration, /updated_at/);
  assert.match(roleConstraintMigration, /DROP CONSTRAINT IF EXISTS users_role_check/);
  assert.match(roleConstraintMigration, /REFERENCES roles\(slug\)/);
  assert.doesNotMatch(roleConstraintMigration, /role IN \(/);
  assert.match(routes, /router\.post\('\/login'/);
  assert.match(routes, /router\.get\('\/requests', protectLogistics/);
  assert.match(routes, /router\.patch\('\/requests\/:requestId\/legs\/:legType\/status', protectLogistics/);
  assert.match(routeIndex, /router\.use\('\/logistics', logisticsRoutes\)/);
  assert.match(middleware, /decoded\.role !== 'logistics'/);
  assert.match(middleware, /req\.logisticsPartner = partner/);
  assert.match(service, /MZIGO_EGO_EMAIL/);
  assert.match(service, /MZIGO_EGO_PASSWORD/);
  assert.match(service, /LOGISTICS_STATUS_MAP/);
  assert.match(service, /ALLOWED_LOGISTICS_TRANSITIONS/);
  assert.match(service, /FOR UPDATE OF lr, ll/);
  assert.match(service, /INSERT INTO logistics_tracking_events/);
  assert.match(service, /source,\s*actor_user_id,\s*actor_label/);
  assert.match(service, /Cannot update an unpaid logistics leg/);
  assert.match(service, /lr\.partner_id = \$1/);
  assert.match(service, /pl\.status <> 'payment_pending'/);
  assert.match(service, /dp\.status::text = ANY\(\$3::text\[\]\)/);
  assert.match(service, /oi\.product_name/);
  assert.match(service, /oi\.product_price/);
  assert.doesNotMatch(`${service}\n${logisticsEvents}\n${trackingService}`, /\boi\.(name|price)\b/);
  assert.doesNotMatch(requestReadMethod, /UPDATE\s+(payments|product_orders|withdrawal_requests)/i);
  assert.doesNotMatch(requestReadMethod, /INSERT INTO\s+(payments|product_orders|withdrawal_requests)/i);
  assert.match(readyForBuyerHelper, /UPDATE product_orders/);
  assert.match(readyForBuyerHelper, /status = 'READY_FOR_BUYER'/);
  assert.doesNotMatch(readyForBuyerHelper, /total_amount|seller_payout_amount|platform_fee|payment_status|payment_reference|completed_at/);
  assert.doesNotMatch(service, /UPDATE\s+(payments|withdrawal_requests|seller_balances|wallets)/i);
  assert.doesNotMatch(service, /INSERT INTO\s+(payments|product_orders|withdrawal_requests|seller_balances|wallets)/i);
  assert.match(frontendRoutes, /\/mzigo\/dashboard/);
  assert.match(frontendApi, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(frontendApi, /updateLogisticsLegStatus/);
  assert.match(frontendDashboard, /Pickup \+ Delivery/);
  assert.match(frontendDashboard, /Delivery Only/);
  assert.match(frontendDashboard, /Pickup Only/);
  assert.match(frontendDashboard, /Hub Drop-off \/ Hub Collection/);
  assert.match(frontendDashboard, /pickup_assigned/);
  assert.match(frontendDashboard, /out_for_delivery/);
  assert.match(frontendDashboard, /delivered/);
});

test('admin logistics oversight can inspect, override, and resolve disputes without touching money state', () => {
  const adminRoutes = read('src/routes/admin.routes.js');
  const adminController = read('src/controllers/admin.controller.js');
  const service = read('src/services/logisticsDashboard.service.js');
  const escrowManager = read('src/services/EscrowManager.js');
  const orderService = read('src/services/order.service.js');
  const adminApi = read('../src/api/adminApi.ts');
  const adminDashboard = read('../src/pages/admin/NewDashboardPage.tsx');
  const adminLogisticsTab = read('../src/pages/admin/components/AdminLogisticsTab.tsx');

  assert.match(adminRoutes, /router\.get\('\/logistics\/requests'/);
  assert.match(adminRoutes, /router\.patch\('\/logistics\/requests\/:requestId\/legs\/:legType\/status'/);
  assert.match(adminRoutes, /router\.post\('\/logistics\/requests\/:requestId\/disputes\/resolve'/);
  assert.match(adminController, /LogisticsDashboardService\.getAdminRequests/);
  assert.match(adminController, /LogisticsDashboardService\.adminUpdateLegStatus/);
  assert.match(adminController, /LogisticsDashboardService\.adminResolveDispute/);

  assert.match(service, /static async getAdminRequests/);
  assert.match(service, /static async adminUpdateLegStatus/);
  assert.match(service, /static async adminResolveDispute/);
  assert.match(service, /ADMIN_LOGISTICS_STATUS_FILTERS/);
  assert.match(service, /FOR UPDATE OF lr, ll/);
  assert.match(service, /assertValidLegTransition/);
  assert.match(service, /Cannot update an unpaid logistics leg/);
  assert.match(service, /admin\.status_override/);
  assert.match(service, /admin\.status_reviewed/);
  assert.match(service, /admin\.dispute_resolved/);
  assert.match(service, /source,\s*actor_user_id,\s*actor_label/);
  assert.match(service, /eventBus\.enqueueInTransaction\(client,\s*AppEvents\.LOGISTICS\.NOTIFICATION/);
  assert.match(service, /lr\.status = 'manual_review'/);
  assert.match(service, /lr\.metadata->'admin_dispute_resolution'/);

  assert.doesNotMatch(service, /UPDATE\s+(payments|withdrawal_requests|seller_balances|wallets)/i);
  assert.doesNotMatch(service, /INSERT INTO\s+(payments|product_orders|withdrawal_requests|seller_balances|wallets)/i);
  assert.match(escrowManager, /FROM logistics_requests lr/);
  assert.match(escrowManager, /logistics_delivery_hold/);
  assert.match(orderService, /Escrow release blocked/);
  assert.doesNotMatch(escrowManager, /delivered[\s\S]*releaseFunds/);

  assert.match(adminApi, /getLogisticsRequests/);
  assert.match(adminApi, /updateLogisticsLegStatus/);
  assert.match(adminApi, /resolveLogisticsDispute/);
  assert.match(adminDashboard, /AdminLogisticsTab/);
  assert.match(adminLogisticsTab, /Logistics Oversight/);
  assert.match(adminLogisticsTab, /Tracking history/);
  assert.match(adminLogisticsTab, /Call buyer/);
  assert.match(adminLogisticsTab, /Call seller/);
  assert.match(adminLogisticsTab, /Call Mzigo/);
  assert.match(adminLogisticsTab, /Flag review/);
  assert.match(adminLogisticsTab, /Continue delivery/);
  assert.match(adminLogisticsTab, /Mark failed/);
  assert.match(adminLogisticsTab, /Resolve dispute/);
  assert.match(adminLogisticsTab, /Escrow release stays under order completion rules/);
});

test('logistics regression contracts cover optional delivery, grouping, idempotency, transitions, and milestone dedupe', () => {
  const paymentService = read('src/services/payment.service.js');
  const logisticsRequestService = read('src/services/logisticsRequest.service.js');
  const logisticsDashboardService = read('src/services/logisticsDashboard.service.js');
  const logisticsMigration = read('migrations/20260510010000_add_logistics_data_model.sql');
  const deliveredLogisticsSyncMigration = read('migrations/20260512170000_sync_delivered_logistics_ready_for_buyer.sql');
  const logisticsEvents = read('src/events/logistics.events.js');
  const recipientDelivery = read('src/events/recipientDelivery.js');
  const phoneModal = read('../src/components/PhoneCheckModal.tsx');
  const productCard = read('../src/components/ProductCard.tsx');
  const productCardUtils = read('../src/components/product-card/productCardUtils.ts');
  const productCardModals = read('../src/components/product-card/ProductCardModals.tsx');

  assert.match(phoneModal, /doorDelivery:\s*false/);
  assert.match(phoneModal, /doorDelivery:\s*true/);
  assert.match(phoneModal, /canUseDoorDelivery = Boolean\(isPhysicalProduct && productPrice > 0\)/);
  assert.match(phoneModal, /wantsDoorDelivery = canUseDoorDelivery && doorDeliveryEnabled/);
  assert.match(productCardUtils, /isPhysical = productType === 'physical' && !isDigital && !isService/);
  assert.match(productCard, /doorDeliverySelectionRef\.current = isPhysical && delivery\?\.doorDelivery \? delivery : null/);
  assert.match(productCard, /wantsDoorDelivery = isPhysical && doorDeliverySelection\?\.doorDelivery === true/);
  assert.match(productCardModals, /isPhysicalProduct=\{isPhysicalProduct\}/);
  assert.doesNotMatch(productCardModals, /!product\.is_digital && product\.product_type !== 'service'/);
  assert.match(productCard, /wantsDoorDelivery/);
  assert.match(productCard, /delivery:\s*wantsDoorDelivery \?/);
  assert.match(paymentService, /if \(wantsDoorDelivery\)/);
  assert.match(paymentService, /assertDoorDeliveryLocation\(buyerDeliveryLocation\)/);
  assert.match(paymentService, /buyerDeliveryFee = deliveryQuote\.feeAmount/);
  assert.match(paymentService, /PRODUCT_SERVICE_CHARGE_RATE\s*=\s*Fees\.PRODUCT_SERVICE_CHARGE_RATE/);
  assert.match(read('src/config/fees.js'), /PRODUCT_SERVICE_CHARGE_RATE:\s*0\.02/);
  assert.match(paymentService, /roundPayableTotal\s*=\s*\(amount\)\s*=>\s*Math\.ceil\(roundMoney\(amount\)\)/);
  assert.match(paymentService, /paymentBaseTotal\s*=\s*roundMoney\(productSubtotal \+ buyerDeliveryFee\)/);
  assert.match(paymentService, /productServiceCharge\s*=\s*calculateProductServiceCharge\(productSubtotal\)/);
  assert.match(paymentService, /payableTotal\s*=\s*roundPayableTotal\(paymentBaseTotal \+ productServiceCharge\)/);
  assert.doesNotMatch(paymentService, /payableTotal\s*=\s*.*frontendQuote/);

  assert.match(paymentService, /LogisticsQuoteService\.quoteSellerPickup\(pickup\)/);
  assert.match(logisticsRequestService, /ON CONFLICT \(order_id\) DO UPDATE/);
  assert.match(logisticsRequestService, /ON CONFLICT \(logistics_request_id, leg_type\) DO UPDATE/);
  assert.match(logisticsRequestService, /ON CONFLICT \(event_key\) WHERE event_key IS NOT NULL DO NOTHING/);
  assert.match(logisticsMigration, /CONSTRAINT logistics_requests_order_id_unique UNIQUE \(order_id\)/);
  assert.match(logisticsMigration, /CONSTRAINT logistics_legs_request_leg_type_unique UNIQUE \(logistics_request_id, leg_type\)/);
  assert.match(logisticsDashboardService, /pickupDelivery/);
  assert.match(logisticsDashboardService, /deliveryOnly/);
  assert.match(logisticsDashboardService, /pickupOnly/);
  assert.match(logisticsDashboardService, /hubDropoff/);
  assert.match(logisticsDashboardService, /const completed = requests[\s\S]*request => request\.isCompleted/);
  assert.match(logisticsDashboardService, /po\.status AS order_status/);
  assert.match(logisticsDashboardService, /Invalid \$\{legType\} transition/);
  assert.match(logisticsDashboardService, /ALLOWED_LOGISTICS_TRANSITIONS/);
  assert.match(logisticsDashboardService, /WHEN \$3 THEN COALESCE\(completed_at, NOW\(\)\)/);
  assert.match(logisticsDashboardService, /nextStatus === 'completed'/);
  assert.doesNotMatch(logisticsDashboardService, /WHEN \$2 = 'completed'/);
  assert.match(logisticsDashboardService, /markOrderReadyForBuyerAfterDeliveredLeg/);
  assert.match(logisticsDashboardService, /status = 'READY_FOR_BUYER'/);
  assert.match(logisticsDashboardService, /internalStatus === 'delivered'/);
  assert.match(deliveredLogisticsSyncMigration, /UPDATE product_orders po/);
  assert.match(deliveredLogisticsSyncMigration, /SET status = 'READY_FOR_BUYER'/);
  assert.match(deliveredLogisticsSyncMigration, /ll\.status IN \('delivered', 'completed'\)/);
  assert.doesNotMatch(deliveredLogisticsSyncMigration, /payment_status|seller_payout_amount|platform_fee|total_amount|wallet|withdrawal/i);

  assert.match(logisticsEvents, /eventBus\.deliverRecipient/);
  assert.match(recipientDelivery, /ON CONFLICT \(event_id, recipient_key, channel\)/);
  assert.match(recipientDelivery, /Recipient delivery already completed; suppressing duplicate/);
});

test('unified order flow exposes seller hub handoff and service booking actions', () => {
  const migration = read('migrations/20260511010000_unified_order_logistics_statuses.sql');
  const orderService = read('src/services/order.service.js');
  const orderHubDropoffService = read('src/services/orderHubDropoff.service.js');
  const logisticsRequestService = read('src/services/logisticsRequest.service.js');
  const paymentEvents = read('src/events/payment.events.js');
  const sellerRoutes = read('src/routes/seller.routes.js');
  const orderController = read('src/controllers/order.controller.js');
  const sellerApi = read('../src/api/seller/ordersApi.ts');
  const sellerOrders = read('../src/components/seller/SellerOrdersSection.tsx');

  assert.match(migration, /AWAITING_SELLER_ACTION/);
  assert.match(migration, /FULFILLING/);
  assert.match(migration, /READY_FOR_BUYER/);
  assert.match(logisticsRequestService, /ensurePhysicalOnlineRequestAfterPayment/);
  assert.match(logisticsRequestService, /seller_handoff\.awaiting_choice/);
  assert.match(paymentEvents, /ensurePhysicalOnlineRequestAfterPayment/);

  assert.match(orderHubDropoffService, /static async selectHubDropoff/);
  assert.match(orderHubDropoffService, /static async markDroppedAtHub/);
  assert.match(orderService, /static async confirmBooking/);
  assert.match(orderHubDropoffService, /seller_handoff\.dropoff_selected/);
  assert.match(orderHubDropoffService, /seller_handoff\.dropped_at_hub/);
  assert.doesNotMatch(orderService, /BookingService/);

  assert.match(sellerRoutes, /\/orders\/:id\/select-hub-dropoff/);
  assert.match(sellerRoutes, /\/orders\/:id\/mark-dropped-at-hub/);
  assert.match(sellerRoutes, /\/orders\/:id\/confirm-booking/);
  assert.match(orderController, /OrderHubDropoffService\.selectHubDropoff/);
  assert.match(orderController, /OrderHubDropoffService\.markDroppedAtHub/);
  assert.match(orderController, /OrderService\.confirmBooking/);
  assert.match(sellerApi, /selectHubDropoff/);
  assert.match(sellerApi, /markDroppedAtHub/);
  assert.match(sellerApi, /confirmBooking/);

  assert.match(sellerOrders, /Drop off at Mzigo Ego/);
  assert.match(sellerOrders, /Request Mzigo pickup/);
  assert.match(sellerOrders, /const canSelectHubDropoff = canChooseHandoff/);
  assert.match(sellerOrders, /const canRequestPickup = isPhysicalOnline/);
  assert.match(sellerOrders, /Confirm Handoff/);
  assert.match(sellerOrders, /Confirm Booking/);
  assert.match(sellerOrders, /Mark Service Delivered/);
  assert.match(sellerOrders, /within 24 hours/);
});

test('logistics WhatsApp notifications are milestone-only and notification-only', () => {
  const index = read('src/index.js');
  const eventTypes = read('src/events/eventTypes.js');
  const logisticsEvents = read('src/events/logistics.events.js');
  const logisticsRequestService = read('src/services/logisticsRequest.service.js');
  const logisticsTrackingLinkService = read('src/services/logisticsTrackingLink.service.js');
  const logisticsDashboardService = read('src/services/logisticsDashboard.service.js');
  const orderEvents = read('src/events/order.events.js');
  const whatsappService = read('src/services/whatsapp.service.js');

  assert.match(index, /await import\('\.\/events\/logistics\.events\.js'\)/);
  assert.match(eventTypes, /LOGISTICS:\s*\{[\s\S]*NOTIFICATION:\s*'logistics\.notification'/);
  assert.match(eventTypes, /AppEvents\.LOGISTICS\.NOTIFICATION/);
  assert.match(logisticsRequestService, /enqueueNewOrderNotification/);
  assert.match(logisticsRequestService, /notificationType:\s*'new_order'/);
  assert.match(logisticsRequestService, /notificationType:\s*'delivery_paid'/);
  assert.match(logisticsRequestService, /notificationType:\s*'pickup_paid'/);
  assert.match(logisticsRequestService, /LogisticsTrackingLinkService\.ensureLinksForRequest/);
  assert.match(logisticsDashboardService, /IMPORTANT_LOGISTICS_STATUS_NOTIFICATIONS/);
  assert.match(logisticsDashboardService, /LogisticsTrackingLinkService\.ensureLinksForRequest/);
  assert.match(logisticsDashboardService, /pickup_assigned/);
  assert.match(logisticsDashboardService, /picked_up_from_seller/);
  assert.match(logisticsDashboardService, /dropped_at_hub/);
  assert.match(logisticsDashboardService, /out_for_delivery/);
  assert.match(logisticsDashboardService, /delivery_delayed/);
  assert.match(logisticsDashboardService, /delivery_failed/);
  assert.match(logisticsDashboardService, /pickup_failed/);
  assert.match(logisticsDashboardService, /eventBus\.enqueueInTransaction\(client,\s*AppEvents\.LOGISTICS\.NOTIFICATION/);
  assert.match(logisticsEvents, /IMPORTANT_LOGISTICS_NOTIFICATION_TYPES/);
  assert.match(logisticsEvents, /new_order/);
  assert.match(logisticsEvents, /whatsappService\.COURIER_NUMBER/);
  assert.match(logisticsEvents, /partnerOnly/);
  assert.match(logisticsEvents, /delivery_paid/);
  assert.match(logisticsEvents, /pickup_paid/);
  assert.match(logisticsEvents, /sendLogisticsMilestoneNotification/);
  assert.match(logisticsEvents, /eventBus\.deliverRecipient/);
  assert.match(logisticsEvents, /LogisticsTrackingLinkService\.getLinksForRequest/);
  assert.match(logisticsTrackingLinkService, /buildToken/);
  assert.match(logisticsTrackingLinkService, /timingSafeEqual/);
  assert.match(logisticsEvents, /WhatsApp is notification-only/);
  assert.match(whatsappService, /WhatsApp is notification only\. Byblos tracking is the source of truth/);
  assert.match(whatsappService, /New Mzigo Order/);
  assert.match(whatsappService, /Open the Mzigo dashboard/);
  assert.match(whatsappService, /COURIER_WHATSAPP_NUMBER/);
  assert.match(whatsappService, /Track here:/);
  assert.doesNotMatch(logisticsEvents, /UPDATE\s+(payments|product_orders|withdrawal_requests|seller_balances|wallets)/i);
  assert.doesNotMatch(logisticsEvents, /INSERT INTO\s+(payments|product_orders|withdrawal_requests|seller_balances|wallets)/i);
  assert.doesNotMatch(orderEvents, /sendLogisticsNotification\(order\)/);
});

test('public tracking links are tokenized and expose only safe logistics fields', () => {
  const migration = read('migrations/20260510040000_add_logistics_tracking_links.sql');
  const schemaCheck = read('src/loaders/schemaCheck.js');
  const routeIndex = read('src/routes/index.js');
  const trackingRoutes = read('src/routes/tracking.routes.js');
  const trackingController = read('src/controllers/tracking.controller.js');
  const trackingService = read('src/services/logisticsTrackingLink.service.js');
  const frontendRoutes = read('../src/routes/index.tsx');
  const trackingApi = read('../src/api/trackingApi.ts');
  const trackingPage = read('../src/pages/TrackingPage.tsx');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS logistics_tracking_links/);
  assert.match(migration, /audience IN \('buyer', 'seller'\)/);
  assert.match(migration, /logistics_tracking_links_request_audience_unique/);
  assert.match(migration, /logistics_tracking_links_public_id_unique/);
  assert.match(schemaCheck, /logistics_tracking_links/);
  assert.match(routeIndex, /router\.use\('\/tracking', trackingRoutes\)/);
  assert.match(trackingRoutes, /router\.get\('\/:token', publicApiRateLimiter, getPublicTrackingByToken\)/);
  assert.match(trackingController, /getSafeTrackingByToken\(req\.params\.token\)/);
  assert.match(trackingService, /TRACKING_LINK_SECRET \|\| process\.env\.JWT_SECRET/);
  assert.match(trackingService, /getSafeTrackingByToken/);
  assert.match(trackingService, /VISIBLE_REQUEST_STATUSES/);
  assert.match(trackingService, /orderNumber/);
  assert.match(trackingService, /timeline/);
  assert.match(trackingService, /mapSafeLeg/);
  assert.doesNotMatch(trackingService, /provider_reference|api_ref|mpesa_receipt|payout|withdrawal/i);
  assert.match(frontendRoutes, /\/track\/:token/);
  assert.match(trackingApi, /\/tracking\/\$\{encodeURIComponent\(token\)\}/);
  assert.match(trackingPage, /Order #\{data\.orderNumber\}/);
  assert.match(trackingPage, /Timeline/);
  assert.match(trackingPage, /ETA/);
});

test('shadow completion cron cannot bypass hardened services and deadline cron uses the hardened service', () => {
  const coreOrder = read('src/core/CoreOrderService.js');
  const cronLoader = read('src/loaders/cron.js');
  const orderDeadlineCron = read('src/cron/orderDeadlineCron.js');
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
  assert.equal(exists('src/cron/orderDeadlineCron.js'), true);
  assert.doesNotMatch(cronLoader, /completionRetryCron/);
  assert.match(cronLoader, /scheduleOrderDeadlineChecks/);
  assert.doesNotMatch(index, /completionRetryCron/);
  assert.match(orderDeadlineCron, /orderDeadlineService\.runAllChecks\(\)/);
  assert.doesNotMatch(orderDeadlineCron, /UPDATE\s+(payments|product_orders|withdrawal_requests|seller_balances|wallets)/i);
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

test('custom physical products validate production SLA and buyer instructions at checkout', () => {
  const migration = read('migrations/20260602180000_custom_physical_product_sla.sql');
  const productService = read('src/services/product.service.js');
  const productModel = read('src/models/product.model.js');
  const paymentService = read('src/services/payment.service.js');
  const phoneModal = read('../src/components/PhoneCheckModal.tsx');
  const productCard = read('../src/components/ProductCard.tsx');
  const addProductForm = read('../src/components/seller/AddProductForm.tsx');
  const editDialog = read('../src/components/seller/products-list/ProductEditDialog.tsx');

  assert.match(migration, /is_custom_product BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /production_days INTEGER/);
  assert.match(migration, /customization_prompt TEXT/);
  assert.match(migration, /custom_production_deadline_at TIMESTAMP WITH TIME ZONE/);
  assert.match(migration, /custom_production_grace_deadline_at TIMESTAMP WITH TIME ZONE/);
  assert.match(migration, /custom_production_reminder_sent_at TIMESTAMP WITH TIME ZONE/);
  assert.match(migration, /production_days BETWEEN 1 AND 5/);
  assert.match(migration, /product_type = 'physical'/);

  assert.match(productService, /Only physical products can be custom products/);
  assert.match(productService, /production days between 1 and 5/);
  assert.match(productModel, /'is_custom_product', 'production_days', 'customization_prompt'/);
  assert.match(productModel, /keys\.map\(key => updateData\[key\]\)/);

  assert.match(paymentService, /Customization instructions are required for this custom product/);
  assert.match(paymentService, /buyer_instructions:\s*customInstructions/);
  assert.match(paymentService, /delivery_starts_after_seller_handoff:\s*true/);
  assert.match(paymentService, /custom_product:\s*isCustomProduct \?/);

  assert.match(phoneModal, /Please describe what you want customized before paying/);
  assert.match(phoneModal, /Custom product: made in up to/);
  assert.match(phoneModal, /Delivery starts after seller handoff/);
  assert.match(productCard, /customization:\s*effectiveIsCustomProduct/);
  assert.match(productCard, /setForceCustomCheckout\(true\)/);
  assert.match(addProductForm, /Select a production time from 1 to 5 days/);
  assert.match(editDialog, /Custom product/);
});

test('imported physical products expose pre-order ready SLA without customization friction', () => {
  const migration = read('migrations/20260602200000_imported_product_preorder_sla.sql');
  const productService = read('src/services/product.service.js');
  const paymentService = read('src/services/payment.service.js');
  const paymentController = read('src/controllers/payment.controller.js');
  const sellerController = read('src/controllers/seller.controller.js');
  const core = read('src/core/CorePaymentService.js');
  const whatsapp = read('src/services/whatsapp.service.js');
  const phoneModal = read('../src/components/PhoneCheckModal.tsx');
  const productCard = read('../src/components/ProductCard.tsx');
  const addProductForm = read('../src/components/seller/AddProductForm.tsx');
  const productsList = read('../src/components/seller/ProductsList.tsx');
  const editDialog = read('../src/components/seller/products-list/ProductEditDialog.tsx');
  const receiptTemplate = read('email-templates/product-payment-receipt.ejs');
  const confirmationTemplate = read('email-templates/product-order-confirmation.ejs');

  assert.match(migration, /is_imported_product BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /import_days INTEGER/);
  assert.match(migration, /import_days IN \(7, 14, 21, 30\)/);
  assert.match(migration, /product_type = 'physical'/);

  assert.match(productService, /Only physical products can be imported or pre-order products/);
  assert.match(productService, /custom product or imported\/pre-order product, not both/);
  assert.match(productService, /7, 14, 21, or 30 days/);

  assert.match(paymentService, /Imported product is misconfigured/);
  assert.match(paymentService, /type:\s*'import_waiting'/);
  assert.match(paymentService, /pre_handoff_sla:\s*preHandoffSla/);
  assert.doesNotMatch(paymentService, /isImportedProduct[\s\S]{0,300}Customization instructions are required/);
  assert.match(paymentController, /Imported product is misconfigured/);
  assert.match(paymentController, /Product cannot be both custom and imported/);
  assert.match(sellerController, /p\.is_imported_product/);
  assert.match(sellerController, /p\.import_days/);
  assert.match(sellerController, /p\.import_note/);

  assert.match(core, /import_waiting/);
  assert.match(whatsapp, /Imported \/ pre-order item/);
  assert.match(receiptTemplate, /Imported \/ Pre-order Item|Imported \/ pre-order item/);
  assert.match(confirmationTemplate, /Imported \/ Pre-order Item|Imported \/ pre-order item/);

  assert.match(phoneModal, /Imported \/ pre-order item: expected ready in up to/);
  assert.doesNotMatch(phoneModal, /isImportedProduct[\s\S]{0,500}Please describe what you want customized before paying/);
  assert.match(productCard, /type:\s*'import_waiting'/);
  assert.match(productCard, /pre_handoff_sla:\s*preHandoffSla/);
  assert.match(addProductForm, /Imported \/ pre-order item/);
  assert.match(productsList, /is_imported_product/);
  assert.match(editDialog, /Imported \/ pre-order item/);
});

test('custom production SLA deadlines, reminders, refunds, and notifications are idempotent', () => {
  const core = read('src/core/CorePaymentService.js');
  const deadlineService = read('src/services/orderDeadline.service.js');
  const eventTypes = read('src/events/eventTypes.js');
  const orderEvents = read('src/events/order.events.js');
  const whatsapp = read('src/services/whatsapp.service.js');
  const logisticsEvents = read('src/events/logistics.events.js');
  const cronLoader = read('src/loaders/cron.js');
  const orderDeadlineCron = read('src/cron/orderDeadlineCron.js');
  const receiptTemplate = read('email-templates/product-payment-receipt.ejs');
  const confirmationTemplate = read('email-templates/product-order-confirmation.ejs');
  const emailUtil = read('src/shared/utils/email.js');

  assert.match(core, /resolveCustomProductionPatch/);
  assert.match(core, /custom_production_deadline_at = COALESCE/);
  assert.match(core, /custom_production_grace_deadline_at = COALESCE/);
  assert.match(core, /production_deadline_at/);
  assert.match(core, /production_grace_deadline_at/);

  assert.match(deadlineService, /checkCustomProductionReminders/);
  assert.match(deadlineService, /checkExpiredCustomProductionDeadlines/);
  assert.match(deadlineService, /INTERVAL '12 hours'/);
  assert.match(deadlineService, /FOR UPDATE SKIP LOCKED/);
  assert.match(deadlineService, /custom_production_reminder_sent_at IS NULL/);
  assert.match(deadlineService, /payment_status = 'failed'/);
  assert.match(deadlineService, /refunds = COALESCE\(refunds, 0\) \+ \$1/);
  assert.match(deadlineService, /NOT EXISTS \([\s\S]*FROM logistics_requests lr/);
  assert.match(deadlineService, /seller_handoff/);
  assert.match(deadlineService, /AppEvents\.ORDER\.CUSTOM_PRODUCTION_REMINDER/);
  assert.match(deadlineService, /AppEvents\.ORDER\.CUSTOM_PRODUCTION_EXPIRED/);

  assert.match(eventTypes, /CUSTOM_PRODUCTION_REMINDER:\s*'order\.custom_production_reminder'/);
  assert.match(eventTypes, /CUSTOM_PRODUCTION_EXPIRED:\s*'order\.custom_production_expired'/);
  assert.match(orderEvents, /sendCustomProductionReminder/);
  assert.match(orderEvents, /sendCustomProductionExpiredNotification/);
  assert.match(whatsapp, /sendCustomProductionReminder/);
  assert.match(whatsapp, /sendCustomProductionExpiredNotification/);
  assert.match(whatsapp, /Delivery starts after seller handoff/);
  assert.match(whatsapp, /check the package against the buyer instructions at handoff/i);
  assert.match(logisticsEvents, /custom_production_deadline_at/);
  assert.match(logisticsEvents, /metadata', oi\.metadata/);

  assert.match(cronLoader, /ENABLE_ORDER_DEADLINE_CRON/);
  assert.match(orderDeadlineCron, /orderDeadlineService\.runAllChecks\(\)/);

  assert.match(receiptTemplate, /Delivery starts after seller handoff/);
  assert.match(confirmationTemplate, /Delivery starts after seller handoff/);
  assert.match(emailUtil, /custom_product/);
  assert.match(emailUtil, /custom_production_deadline_at/);
});
