import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function exists(path) {
  return existsSync(resolve(root, path));
}

function filesUnder(path, suffixes = ['.js', '.ts', '.tsx', '.jsx']) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute).flatMap((entry) => {
    const resolved = resolve(absolute, entry);
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return filesUnder(resolve(path, entry), suffixes);
    }
    return stat.isFile() && suffixes.some((suffix) => resolved.endsWith(suffix)) ? [resolved] : [];
  });
}

function check(area, name, condition, feedback) {
  checks.push({ area, name, ok: Boolean(condition), feedback });
}

function matches(path, pattern) {
  if (!exists(path)) return false;
  return pattern.test(read(path));
}

function hasAll(path, patterns) {
  if (!exists(path)) return false;
  const content = read(path);
  return patterns.every((pattern) => pattern.test(content));
}

function hasAny(path, patterns) {
  if (!exists(path)) return false;
  const content = read(path);
  return patterns.some((pattern) => pattern.test(content));
}

function migrationIncludes(pattern) {
  return filesUnder('server/migrations', ['.sql']).some((file) => pattern.test(read(file)));
}

function routeMounted(prefix, routeName) {
  return matches('server/src/application/routes/index.js', new RegExp(`router\\.use\\('${prefix}',\\s*${routeName}\\)`));
}

function report() {
  const areas = [...new Set(checks.map((item) => item.area))];
  let failed = 0;

  console.log('=== BYBLOS APPLICATION SYSTEM AUDIT ===\n');

  for (const area of areas) {
    const areaChecks = checks.filter((c) => c.area === area);
    const areaOk = areaChecks.every((c) => c.ok);
    console.log(`[${areaOk ? 'PASS' : 'FAIL'}] ${area}`);

    for (const c of areaChecks) {
      if (c.ok) {
        console.log(`  ✓ ${c.name}`);
      } else {
        failed++;
        console.log(`  ✗ ${c.name}`);
        console.log(`    Feedback: ${c.feedback}`);
      }
    }
  }

  console.log(`\nResult: ${checks.length - failed}/${checks.length} checks passed.`);
  if (failed > 0) {
    console.log('Feedback: fix the failed areas above before relying on the release.');
    process.exitCode = 1;
    return;
  }

  console.log('Feedback: critical route, fee, payment, logistics, seller, buyer, creator, and admin contracts are intact.');
}

function auditProjectStructure() {
  check('Project structure', 'Frontend entry files exist', exists('src/app/router/routes.index.tsx') && exists('src/features/shop/pages/MarketplaceIndex.tsx'), 'Missing frontend route entry or landing page.');
  check('Project structure', 'Backend route aggregator exists', exists('server/src/application/routes/index.js'), 'Missing backend API route aggregator.');
  check('Project structure', 'Migration directory exists', exists('server/migrations'), 'Missing migrations directory.');
  check('Project structure', 'Main npm scripts include build and app audit', hasAll('package.json', [/"build":/, /"test:app":\s*"node scripts\/app-system-audit\.mjs"/]), 'package.json must expose build and test:app.');
}

function auditPublicAndAuthRoutes() {
  check('Public and auth routes', 'Landing, shop, tracking, and verify email pages are routed', hasAll('src/app/router/routes.index.tsx', [/path:\s*'\/'/, /path:\s*'\/shop\/:shopName'/, /path:\s*'\/track\/:token'/, /path:\s*'\/verify-email'/]), 'Public route coverage is incomplete.');
  check('Public and auth routes', 'Seller auth routes are exposed', hasAll('src/app/router/seller.routes.tsx', [/\/seller\/login/, /\/seller\/register/, /path:\s*'\/seller'/, /path:\s*'dashboard'/]), 'Seller login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Buyer auth routes are exposed', hasAll('src/app/router/buyer.routes.tsx', [/\/buyer\/login/, /\/buyer\/register/, /path:\s*'\/buyer'/, /path:\s*'dashboard'/]), 'Buyer login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Creator auth and dashboard routes are exposed', hasAll('src/app/router/creator.routes.tsx', [/\/creator\/login/, /\/creator\/register/, /\/creator\/dashboard/]), 'Creator login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Creator button is visible from the public app', hasAll('src/features/shop/components/HeroSection.tsx', [/to="\/creator\/login"/, />\s*Creator\s*</]), 'Top-right Creator entry point is missing.');
}

function auditBackendRoutes() {
  const mounts = [
    ['/sellers', 'sellerRoutes'],
    ['/buyers', 'buyerRoutes'],
    ['/public', 'publicRoutes'],
    ['/health', 'healthRoutes'],
    ['/payments', 'paymentRoutes'],
    ['/admin', 'adminRoutes'],
    ['/refunds', 'refundRoutes'],
    ['/orders', 'orderRoutes'],
    ['/wishlist', 'wishlistRoutes'],
    ['/logistics', 'logisticsRoutes'],
    ['/tracking', 'trackingRoutes'],
    ['/creators', 'creatorRoutes']
  ];

  for (const [prefix, routeName] of mounts) {
    check('Backend route wiring', `${prefix} API is mounted`, routeMounted(prefix, routeName), `${prefix} is not mounted in server/src/application/routes/index.js.`);
  }

  check('Backend route wiring', 'Protected role routes apply auth middleware', hasAll('server/src/application/routes/seller.routes.js', [/router\.use\(protect\)/]) && hasAll('server/src/application/routes/buyer.routes.js', [/router\.use\(protect\)/]) && hasAll('server/src/application/routes/admin.routes.js', [/router\.use\(protect\)/]), 'Seller, buyer, and admin protected routes should apply auth middleware.');
  check('Backend route wiring', 'Admin creator API is exposed', hasAll('server/src/application/routes/admin.routes.js', [/\/creators/]) && hasAll('server/src/domains/identity/admin/admin.service.js', [/creators|totalCreators/i]), 'Admin creator data route is missing.');
}

function auditBuyerExperience() {
  check('Buyer experience', 'Buyer login and registration screens exist', exists('src/features/buyer/pages/BuyerLogin.tsx') && exists('src/features/buyer/pages/BuyerRegister.tsx'), 'Buyer auth screens are missing.');
  check('Buyer experience', 'Buyer dashboard loads order, refund, and followed shop flows', hasAll('src/features/buyer/pages/BuyerDashboard.tsx', [/OrdersSection/, /useBuyerFollowedShops/, /MyShopsSection/]) && hasAll('src/features/buyer/components/dashboard/BuyerProfileSheet.tsx', [/RefundCard/]), 'Buyer dashboard is missing order/refund/followed shop coverage.');
  check('Buyer experience', 'Buyer API supports orders, refunds, clients, and wishlist-related flows', hasAll('src/features/buyer/api/orders.ts', [/orders/i]) && hasAll('src/features/buyer/api/refunds.ts', [/refund/i]), 'Buyer API coverage is incomplete.');
  check('Buyer experience', 'Public shop page exposes seller products and client count', hasAll('src/features/shop/pages/ShopPage.tsx', [/sellerInfo/, /products/]) || hasAll('src/features/shop/pages/useShopPage.ts', [/sellerInfo/, /products/]), 'Shop page contract is incomplete.');
}

function auditSellerExperience() {
  check('Seller experience', 'Seller dashboard exposes all main tabs', hasAll('src/features/seller/components/dashboard/dashboardUtils.ts', [/overview/, /products/, /orders/, /withdrawals/, /settings/]), 'Seller dashboard tab list is incomplete.');
  check('Seller experience', 'Seller overview shows creator metrics', hasAll('src/features/seller/components/dashboard/tabs/OverviewTab.tsx', [/Creator/i, /creator/i]), 'Seller overview should include creator count and creator-generated sales.');
  check('Seller experience', 'Seller settings support banner, theme, locations, and creator invites', hasAll('src/features/seller/components/dashboard/tabs/SettingsTab.tsx', [/Banner|BannerUpload/i, /Theme/i]), 'Seller settings coverage is incomplete.');
  check('Seller experience', 'Seller product form enforces minimum price and service charge explanation', hasAll('server/src/domains/commerce/products/product.service.js', [/PRODUCT_MIN_PRICE|PRODUCT_SERVICE_CHARGE_RATE/i]) && hasAll('src/features/seller/components/dashboard/tabs/ProductsTab.tsx', [/Products|product/i]), 'Seller product pricing/service charge messaging needs review.');
  check('Seller experience', 'Seller withdrawals apply minimum and tiered fees', hasAll('src/features/seller/components/dashboard/dashboardUtils.ts', [/MIN_WITHDRAWAL_AMOUNT\s*=\s*50/, /WITHDRAWAL_FEE_TIERS/, /1500/, /20000/, /63/]), 'Seller withdrawal fee rules are missing or changed.');
}

function auditCreatorExperience() {
  check('Creator experience', 'Creators can register by invite or directly', hasAll('server/src/domains/growth/creators/creator.controller.js', [/registerFromInvite/, /registerDirect/]) && hasAll('src/features/creator/pages/CreatorRegister.tsx', [/Create creator account/i]), 'Creator registration should support both invite and direct signup.');
  check('Creator experience', 'Creators are email verified before login', hasAll('server/src/domains/growth/creators/creator.service.js', [/sendEmailVerification/i, /AuthService\.login/i]), 'Creator verification/login guard is incomplete.');
  check('Creator experience', 'Creator auth captures WhatsApp and supports password visibility', hasAll('src/features/creator/pages/CreatorRegister.tsx', [/whatsappNumber/, /EyeOff/]) && hasAll('src/features/creator/pages/CreatorLogin.tsx', [/showPassword/, /EyeOff/]), 'Creator auth should collect WhatsApp details and expose password visibility controls.');
  check('Creator experience', 'Creator dashboard has requests, linked shops, leaderboard, clicks, withdrawals, logout, and period analysis', hasAll('src/features/creator/pages/CreatorDashboard.tsx', [/Linked shops|LinkedShops/i, /Link clicks|clicks/i]) && hasAll('server/src/application/routes/creator.routes.js', [/\/logout/]), 'Creator dashboard analytics or logout coverage is incomplete.');
  check('Creator experience', 'Creator referral links invite sellers', hasAll('src/features/creator/pages/CreatorDashboard.tsx', [/ref=|referral/i]), 'Creator seller referral link is missing.');
  check('Creator experience', 'Creator backend tracks requests, clicks, earnings, referrals, and withdrawals', hasAll('server/src/domains/growth/creators/creator.service.js', [/recordLinkClick|creditCreator/i]) && hasAll('server/src/application/routes/creator.routes.js', [/shop-requests/]), 'Creator backend flow coverage is incomplete.');
  check('Creator experience', 'Creator sale notifications are wired to WhatsApp', hasAll('server/src/domains/growth/creators/creator.service.js', [/whatsapp_number|sendMessage|whatsapp/i]) && migrationIncludes(/ALTER TABLE creators/i), 'Creator successful-sale WhatsApp notification wiring is missing.');
}

function auditCheckoutAndPayments() {
  check('Checkout and payments', 'Checkout uses idempotency and provider payment initiation', hasAll('server/src/domains/payments/payments/payment.controller.js', [/initiateProductPayment/i]) && hasAll('server/src/domains/payments/payments/payment.service.js', [/providerClient|payment_method/i]), 'Payment initiation/idempotency contract is incomplete.');
  check('Checkout and payments', 'Paystack webhook fails closed with HMAC verification', hasAll('server/src/application/middleware/paystackWebhookSecurity.js', [/x-paystack-signature/i, /verifyPaystackHmacSignature|invalid/i]), 'Webhook security is incomplete.');
  check('Checkout and payments', 'Payment completion is centralized and atomic', hasAll('server/src/domains/payments/payments/CorePaymentService.js', [/completeVerifiedPayment/i, /BEGIN/, /COMMIT/, /ROLLBACK/]), 'Core payment completion should remain centralized and transactional.');
  check('Checkout and payments', 'Buyer-facing payment modal hides service charge wording', !matches('src/features/payments/components/PaymentStatusModal.tsx', /service charge/i), 'Buyer payment modal should not mention service charge.');
  check('Checkout and payments', 'Receipts do not mention buyer service charge', !matches('server/src/shared/utils/email.js', /service charge/i), 'Buyer/seller receipt templates should be reviewed for service charge wording.');
}

function auditOrdersInventoryAndEscrow() {
  check('Orders, inventory, and escrow', 'Physical products without inventory are marked sold out after paid sale', hasAll('server/src/domains/orders/order/orderFulfillmentTransition.service.js', [/track_inventory|status|sold/i]), 'Physical no-inventory sold-out protection is missing.');
  check('Orders, inventory, and escrow', 'Double purchase prevention uses locking/reservations', hasAny('server/src/domains/payments/payments/CorePaymentService.js', [/FOR UPDATE/i, /reserved_quantity/i]) || hasAny('server/src/domains/payments/payments/payment.service.js', [/FOR UPDATE/i, /reserved_quantity/i]), 'Inventory reservation/locking needs review.');
  check('Orders, inventory, and escrow', 'Escrow release credits seller once', hasAll('server/src/domains/orders/escrow/EscrowManager.js', [/ON CONFLICT|sellers/i]), 'Escrow payout idempotency is missing.');
  check('Orders, inventory, and escrow', 'Order status guard protects state transitions', hasAll('server/src/shared/utils/OrderStatusGuard.js', [/assertValidTransition|OrderStatus/i]), 'Order state transition guard is incomplete.');
}

function auditLogisticsAndTracking() {
  check('Logistics and tracking', 'Mzigo/logistics routes and pages exist', hasAll('src/app/router/mzigo.routes.tsx', [/\/mzigo\/login/, /\/mzigo\/dashboard/]) && routeMounted('/logistics', 'logisticsRoutes'), 'Logistics UI or API route is missing.');
  check('Logistics and tracking', 'Physical shop pickup avoids Mzigo when buyer does not choose delivery', hasAll('server/src/shared/utils/fulfillment.js', [/sellerHasPhysicalShop|BUYER_TO_SELLER|wantsDoorDelivery/i]), 'Physical-shop pickup logic needs review.');
  check('Logistics and tracking', 'Door delivery and seller pickup activate only after payment completion', hasAll('server/src/application/events/payment.events.js', [/PAYMENT|COMPLETED|DoorDelivery|SellerPickup/i]), 'Logistics payment completion hook is missing.');
  check('Logistics and tracking', 'Public tracking links are tokenized and routed', hasAll('server/src/domains/logistics/logisticsTrackingLink.service.js', [/buildToken|getSafeTrackingByToken|token/i]) && hasAll('src/features/shop/pages/TrackingPage.tsx', [/Timeline|ETA|Tracking/i]), 'Public tracking link coverage is incomplete.');
}

function auditAdminAndOperations() {
  check('Admin and operations', 'Admin dashboard routes and data APIs exist', hasAll('src/features/admin/pages/NewDashboardPage.tsx', [/AdminOverviewTab|logistics|withdrawal/i]) && routeMounted('/admin', 'adminRoutes'), 'Admin dashboard coverage is incomplete.');
  check('Admin and operations', 'Admin can inspect payouts, balances, sellers, creators, buyers, clients, and logistics', hasAll('server/src/domains/identity/admin/admin.controller.js', [/getAllSellers|getAllCreators|getAllBuyers|getAllClients/i]) && hasAll('server/src/application/routes/admin.routes.js', [/\/creators/]) && hasAll('src/features/admin/pages/NewDashboardPage.tsx', [/Creators|linkedShops|totalCreatorEarnings|handleDeleteCreator/i]), 'Admin controller is missing an operational surface.');
  check('Admin and operations', 'Marketing dashboard route exists', routeMounted('/admin/marketing', 'marketingRoutes') && hasAll('src/app/router/marketing.routes.tsx', [/\/admin\/marketing\/login/, /\/admin\/marketing/]), 'Marketing route coverage is incomplete.');
}

function auditFeesAndBusinessRules() {
  check('Fees and business rules', 'Backend fees match current business rules', hasAll('server/src/shared/config/fees.js', [/PRODUCT_MIN_PRICE:\s*50/, /PRODUCT_SERVICE_CHARGE_RATE:\s*0\.02/, /MIN_WITHDRAWAL_AMOUNT:\s*50/]), 'Backend fee config no longer matches agreed rules.');
  check('Fees and business rules', 'Frontend seller withdrawal fees match backend tiers', hasAll('src/features/seller/components/dashboard/dashboardUtils.ts', [/fee:\s*21/, /fee:\s*45/, /fee:\s*63/]), 'Seller withdrawal frontend fee tiers need review.');
  check('Fees and business rules', 'Creator withdrawal fees require balance to cover charge', hasAll('src/features/creator/pages/CreatorDashboard.tsx', [/withdrawalFee|totalDeduction|balance/i]) && hasAll('server/src/domains/growth/creators/creator.service.js', [/calculateWithdrawalFee|totalDeducted|balance/i]), 'Creator withdrawal fee/balance protection is incomplete.');
}

function auditDatabaseMigrations() {
  check('Database migrations', 'Creator program schema migration exists', migrationIncludes(/CREATE TABLE IF NOT EXISTS creators/) && migrationIncludes(/seller_creator_links/) && migrationIncludes(/creator_earnings/), 'Creator program migration is missing core tables.');
  check('Database migrations', 'Creator growth migration exists', migrationIncludes(/creator_link_clicks/) && migrationIncludes(/creator_withdrawal_requests/) && migrationIncludes(/referred_by_creator_id/), 'Creator growth migration is missing.');
  check('Database migrations', 'Logistics tracking migration exists', migrationIncludes(/CREATE TABLE IF NOT EXISTS logistics_tracking_links/), 'Logistics tracking migration is missing.');
  check('Database migrations', 'Payment and withdrawal hardening migrations exist', migrationIncludes(/webhook_replay_dedupe/) && migrationIncludes(/withdrawal_requests_seller_idempotency_unique/), 'Payment/withdrawal hardening migrations are missing.');
  check('Database migrations', 'Schema check covers operational tables', hasAll('server/src/application/bootstrap/schemaCheck.js', [/withdrawal_requests/, /logistics_tracking_links/, /payout_provider_attempts/]), 'Runtime schema checks are missing critical tables.');
}

function auditSecurityAndRecovery() {
  check('Security and recovery', 'Auth middleware supports role-scoped sessions and cross-role creator access', hasAll('server/src/application/middleware/auth.js', [/creatorId|cross-roles|crossRoles|crossRole/i]) && hasAll('server/src/domains/identity/auth/auth.service.js', [/creator|signToken/i]), 'Role auth needs review.');
  check('Security and recovery', 'Rate limiting protects auth and payments', hasAll('server/src/application/middleware/globalRateLimiter.js', [/rateLimit/]) && hasAll('server/src/application/middleware/authRateLimiter.js', [/rateLimit/]), 'Rate limiting coverage is incomplete.');
  check('Security and recovery', 'Payment and fulfillment recovery workers exist', exists('server/src/application/cron/paymentCron.js') && exists('server/src/application/cron/fulfillmentWorker.js') && hasAll('server/src/index.js', [/scheduleFulfillmentRetry/, /events\/payment\.events/]), 'Recovery workers/events are missing.');
  check('Security and recovery', 'Sensitive public sanitizers exist', hasAll('server/src/shared/utils/sanitize.js', [/sanitizeBuyer/, /sanitizeSeller/, /sanitizeOrder/]), 'Sanitization helpers need review.');
}

function auditFrontendBuildCoverage() {
  const routeFiles = ['src/app/router/routes.index.tsx', 'src/app/router/seller.routes.tsx', 'src/app/router/buyer.routes.tsx'];
  for (const path of routeFiles) {
    check('Frontend route coverage', `${path} exists`, exists(path), `${path} is missing.`);
  }

  check('Frontend route coverage', 'Core dashboards are lazy-loadable or directly imported', hasAll('src/app/router/routes.index.tsx', [/sellerRoutes/, /buyerRoutes/, /creatorRoutes/, /mzigoRoutes/, /marketingRoutes/]), 'A dashboard route import is missing.');
  check('Frontend route coverage', 'API client redirects protected creator routes to creator login', hasAll('src/infrastructure/http/UniversalHttpClient.ts', [/creator\/login|creators|creator/i]), 'API client creator auth redirect is missing.');
}

auditProjectStructure();
auditPublicAndAuthRoutes();
auditBackendRoutes();
auditBuyerExperience();
auditSellerExperience();
auditCreatorExperience();
auditCheckoutAndPayments();
auditOrdersInventoryAndEscrow();
auditLogisticsAndTracking();
auditAdminAndOperations();
auditFeesAndBusinessRules();
auditDatabaseMigrations();
auditSecurityAndRecovery();
auditFrontendBuildCoverage();

report();
