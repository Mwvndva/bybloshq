import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

test('WhatsApp control routes require admin permission after authentication', () => {
  const source = read('server/src/routes/whatsapp.routes.js');

  assert.match(source, /import\s+\{\s*protect,\s*hasPermission\s*\}/);
  assert.match(source, /const requireAdmin = hasPermission\('manage-all'\)/);
  assert.match(source, /router\.get\('\/qr', protect, requireAdmin,/);
  assert.match(source, /router\.post\('\/initialize', protect, requireAdmin,/);
  assert.match(source, /router\.post\('\/logout', protect, requireAdmin,/);
  assert.match(source, /router\.post\('\/test', protect, requireAdmin,/);
});

test('creator routes require a real creator profile and never fall back to profileId', () => {
  const routes = read('server/src/routes/creator.routes.js');
  const controller = read('server/src/controllers/creator.controller.js');

  assert.match(routes, /const requireCreatorProfile = \(req, res, next\) =>/);
  assert.match(routes, /router\.use\(protect\);\s*router\.use\(requireCreatorProfile\);/s);
  assert.doesNotMatch(controller, /creatorId\s*\|\|\s*req\.user\.profileId/);
  assert.doesNotMatch(controller, /entityId:\s*req\.user\.creatorId\s*\|\|\s*req\.user\.profileId/);
});

test('digital product uploads require seller authorization before multer writes files', () => {
  const source = read('server/src/routes/seller.routes.js');

  assert.match(source, /const requireSellerProfile = \(req, res, next\) =>/);
  assert.match(
    source,
    /router\.post\('\/products\/upload-digital',\s*uploadRateLimiter,\s*requireSellerProfile,\s*hasPermission\('manage-products'\),\s*digitalUpload\.single\('digital_file'\),/s
  );
});

test('paid digital files are blocked from public static upload serving', () => {
  const expressLoader = read('server/src/loaders/express.js');
  const nginxConfig = read('nginx/production.nginx.conf');

  assert.match(expressLoader, /app\.use\('\/uploads\/digital_products'/);
  assert.match(expressLoader, /res\.status\(404\)\.json\(\{ status: 'error', message: 'Not found' \}\)/);
  assert.match(nginxConfig, /location \^~ \/uploads\/digital_products\s*\{\s*return 404;/s);
});

test('public order status no longer accepts internal numeric order ids', () => {
  const source = read('server/src/repositories/publicOrderStatus.repository.js');

  assert.match(source, /WHERE po\.order_number = \$1/);
  assert.doesNotMatch(source, /po\.id::text\s*=\s*\$1/);
});
