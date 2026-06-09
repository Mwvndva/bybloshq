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

test('buyer profile updates use a strict allowlist and cannot write refund balances', () => {
  const model = read('server/src/models/buyer.model.js');
  const controller = read('server/src/controllers/buyer.controller.js');

  assert.match(model, /const fieldMap = \{/);
  assert.match(model, /const dbField = fieldMap\[key\];/);
  assert.doesNotMatch(model, /fieldMap\[key\]\s*\|\|\s*key/);
  assert.doesNotMatch(model, /refunds:\s*['"]refunds['"]/);
  assert.doesNotMatch(model, /isVerified:\s*['"]is_verified['"]/);
  assert.match(controller, /const allowedProfileFields = new Set/);
  assert.match(controller, /allowedProfileFields\.has\(key\)/);
});

test('public buyer phone lookup returns no buyer identity or location PII', () => {
  const routes = read('server/src/routes/buyer.routes.js');
  const controller = read('server/src/controllers/buyer.controller.js');

  assert.match(routes, /router\.post\('\/check-phone', buyerController\.checkBuyerByPhone\)/);
  assert.match(controller, /hasEmail: !!existingBuyer\.email/);
  assert.doesNotMatch(controller, /id:\s*existingBuyer\.id/);
  assert.doesNotMatch(controller, /fullName:\s*existingBuyer/);
  assert.doesNotMatch(controller, /latitude:\s*existingBuyer/);
  assert.doesNotMatch(controller, /longitude:\s*existingBuyer/);
});

test('regular protected auth queries require active users and active seller cross-role hydration', () => {
  const source = read('server/src/middleware/auth.js');

  assert.match(source, /WHERE u\.id = \$1\s+AND u\.is_active = true\s+AND \(b\.status = 'active'/s);
  assert.match(source, /WHERE u\.id = \$1\s+AND u\.is_active = true\s+AND COALESCE\(s\.status, 'active'\) = 'active'/s);
  assert.match(source, /WHERE u\.id = \$1\s+AND u\.is_active = true\s+AND c\.id IS NOT NULL/s);
  assert.match(source, /SELECT id FROM sellers WHERE user_id = \$1 AND COALESCE\(status, 'active'\) = 'active' LIMIT 1/);
  assert.match(source, /CacheService\.set\(cacheKey, crossRoles, Math\.ceil\(AUTH_CACHE_TTL_MS \/ 1000\)\)/);
});

test('login user lookup includes and enforces is_active', () => {
  const userModel = read('server/src/models/user.model.js');
  const authService = read('server/src/services/auth.service.js');

  assert.match(userModel, /SELECT id, email, password_hash, role, is_verified, is_active FROM users/);
  assert.match(authService, /if \(user\.is_active === false\)/);
  assert.match(authService, /ACCOUNT_DEACTIVATED/);
});

test('seller protected routes require a real seller profile and invite actions never fall back to profileId', () => {
  const routes = read('server/src/routes/seller.routes.js');
  const controller = read('server/src/controllers/creator.controller.js');

  assert.match(routes, /router\.use\(protect\);\s*router\.use\(requireSellerProfile\);/s);
  assert.match(controller, /sellerId: req\.user\.sellerId/);
  assert.match(controller, /CreatorService\.listSellerInvites\(req\.user\.sellerId\)/);
  assert.doesNotMatch(controller, /sellerId\s*\|\|\s*req\.user\.profileId/);
  assert.doesNotMatch(controller, /listSellerInvites\(req\.user\.sellerId\s*\|\|\s*req\.user\.profileId\)/);
});

test('WhatsApp admin routes are not globally excluded from CSRF', () => {
  const expressLoader = read('server/src/loaders/express.js');

  assert.doesNotMatch(expressLoader, /req\.path\.startsWith\('\/api\/whatsapp\/'\)/);
  assert.doesNotMatch(expressLoader, /req\.path\.startsWith\('\/api\/payments\/initiate-product'\)/);
  assert.match(expressLoader, /req\.path\.startsWith\('\/api\/payments\/webhook'\)/);
  assert.match(expressLoader, /req\.path\.startsWith\('\/api\/webhooks\/'\)/);
});

test('native app origins and production CSRF cookies support authenticated app requests', () => {
  const expressLoader = read('server/src/loaders/express.js');
  const csrfController = read('server/src/controllers/csrf.controller.js');

  assert.match(expressLoader, /const nativeAppOrigins = \[/);
  assert.match(expressLoader, /nativeAppOrigins[\s\S]*'capacitor:\/\/localhost'[\s\S]*'ionic:\/\/localhost'[\s\S]*'https:\/\/localhost'/);
  assert.match(expressLoader, /checkOrigin\(nativeAppOrigins, origin\)\s*\|\|\s*\(isLocal && checkOrigin\(localOrigins, origin\)\)/);
  assert.match(csrfController, /sameSite:\s*isProduction\s*\?\s*'none'\s*:\s*'lax'/);
});

test('base64 image handling allowlists safe raster types and verifies magic bytes', () => {
  const source = read('server/src/services/image.service.js');
  const expressLoader = read('server/src/loaders/express.js');

  assert.match(source, /'image\/jpeg': 'jpg'/);
  assert.match(source, /'image\/png': 'png'/);
  assert.match(source, /'image\/webp': 'webp'/);
  assert.match(source, /hasExpectedMagicBytes\(buffer, mimeType\)/);
  assert.doesNotMatch(source, /data:image\\\/\(\[a-zA-Z\]\*\)/);
  assert.match(expressLoader, /X-Content-Type-Options', 'nosniff'/);
});

test('marketing auth performs a database-backed current-user authorization check', () => {
  const source = read('server/src/middleware/marketingAuth.js');

  assert.match(source, /import \{ query \} from '\.\.\/shared\/db\/database\.js'/);
  assert.match(source, /export const protectMarketing = async/);
  assert.match(source, /AND is_active = true/);
  assert.match(source, /AND role = ANY\(\$2::text\[\]\)/);
  assert.match(source, /req\.marketingUser = \{ id: user\.id, email: user\.email, role: user\.role \}/);
});
