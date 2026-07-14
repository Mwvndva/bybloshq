import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

test('API process role skips background worker services', () => {
  const loader = read('server/src/loaders/index.js');
  const index = read('server/src/index.js');
  const worker = read('server/src/worker.js');
  const packageJson = read('server/package.json');
  const compose = read('docker-compose.yml');

  assert.match(loader, /BYBLOS_PROCESS_ROLE \|\| 'all'/);
  assert.match(loader, /!\['api', 'web'\]\.includes\(processRole\)/);
  assert.match(loader, /Worker services skipped for API-only process role/);
  assert.match(index, /Unified fulfillment-retry cron skipped for API-only process role/);
  assert.match(worker, /BYBLOS_PROCESS_ROLE = process\.env\.BYBLOS_PROCESS_ROLE \|\| 'worker'/);
  assert.match(worker, /await servicesLoader\(\)/);
  assert.match(worker, /await cronLoader\(\)/);
  assert.match(packageJson, /"start:worker": "node src\/worker\.js"/);
  assert.match(compose, /BYBLOS_PROCESS_ROLE: \$\{BYBLOS_API_PROCESS_ROLE:-all\}/);
  assert.match(compose, /container_name: byblos-worker/);
  assert.match(compose, /profiles:\s+- split-workers/);
  assert.match(compose, /command: \["npm", "run", "start:worker"\]/);
});

test('mobile notification infrastructure is user-owned and channel-neutral', () => {
  const migration = read('server/migrations/20260608120000_mobile_notifications.sql');
  const service = read('server/src/services/notification.service.js');
  const controller = read('server/src/controllers/notification.controller.js');
  const routes = read('server/src/routes/notification.routes.js');
  const routeIndex = read('server/src/routes/index.js');

  assert.match(migration, /CREATE TABLE IF NOT EXISTS notification_device_tokens/);
  assert.match(migration, /user_id INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS app_notifications/);
  assert.match(migration, /recipient_user_id INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(service, /VALID_CHANNELS = new Set\(\['in_app', 'push', 'email'\]\)/);
  assert.match(service, /registerDeviceToken/);
  assert.match(service, /createInAppNotification/);
  assert.match(service, /sendPush/);
  assert.match(service, /FCM_SERVER_KEY/);
  assert.match(controller, /req\.user\?\.userId \|\| req\.user\?\.id/);
  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.post\('\/devices',[\s\S]*?registerDevice\)/);
  assert.match(routes, /router\.get\('\/', listNotifications\)/);
  assert.match(routeIndex, /router\.use\('\/notifications', notificationRoutes\)/);
});

test('product payment initiation is owned by CorePaymentService with legacy compatibility wrapper', () => {
  const controller = read('server/src/controllers/payment.controller.js');
  const paymentService = read('server/src/services/payment.service.js');
  const paymentLifecycleService = read('server/src/services/paymentLifecycle.service.js');
  const core = read('server/src/core/CorePaymentService.js');
  const provider = read('server/src/providers/PaystackProviderClient.js');

  assert.match(controller, /paymentService\.initiateProductPayment\(normalizedOrder\)/);
  assert.match(paymentService, /import CorePaymentService from '\.\.\/core\/CorePaymentService\.js'/);
  assert.match(paymentService, /extends BasePaymentService/);
  assert.match(paymentService, /return CorePaymentService\.initiateProductPayment\(normalizedOrder\)/);
  assert.doesNotMatch(paymentService, /async initiateProductPaymentLegacy\(normalizedOrder\)/);
  assert.match(paymentLifecycleService, /async initiateProductPaymentLegacy\(normalizedOrder\)/);
  assert.match(paymentLifecycleService, /providerClient\.initiateCharge\(paymentData\)/);
  assert.match(paymentLifecycleService, /providerClient\.verifyTransaction\(transactionId\)/);
  assert.match(core, /async initiateProductPayment\(normalizedOrder\)\s*\{\s*const \{ default: paymentLifecycleService \} = await import\('\.\.\/services\/paymentLifecycle\.service\.js'\);\s*return paymentLifecycleService\.initiateProductPaymentLegacy\(normalizedOrder\);/s);
  assert.match(provider, /initiateCharge/);
  assert.match(provider, /verifyTransaction/);
  assert.doesNotMatch(provider, /UPDATE\s+product_orders/i);
  assert.doesNotMatch(provider, /UPDATE\s+payments/i);
  assert.doesNotMatch(provider, /INSERT\s+INTO\s+product_orders/i);
});
