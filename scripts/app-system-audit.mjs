import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const checks = [];
const warnings = [];

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
  return pattern.test(read(path));
}

function hasAll(path, patterns) {
  const content = read(path);
  return patterns.every((pattern) => pattern.test(content));
}

function hasAny(path, patterns) {
  const content = read(path);
  return patterns.some((pattern) => pattern.test(content));
}

function migrationIncludes(pattern) {
  return filesUnder('server/migrations', ['.sql']).some((file) => pattern.test(read(file)));
}

function routeMounted(prefix, routeName) {
  return matches('server/src/routes/index.js', new RegExp(`router\\.use\\('${prefix}',\\s*${routeName}\\)`));
}

function report() {
  const areas = [...new Set(checks.map((item) => item.area))];
  let failed = 0;

  console.log('\nByblos app system audit\n');
  for (const area of areas) {
    console.log(area);
    for (const item of checks.filter((checkItem) => checkItem.area === area)) {
      const marker = item.ok ? 'PASS' : 'FAIL';
      console.log(`  [${marker}] ${item.name}`);
      if (!item.ok && item.feedback) {
        console.log(`         ${item.feedback}`);
        failed += 1;
      }
    }
  }

  if (warnings.length) {
    console.log('\nReview notes');
    for (const warning of warnings) {
      console.log(`  [WARN] ${warning}`);
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
  check('Project structure', 'Frontend entry files exist', exists('src/routes/index.tsx') && exists('src/pages/Index.tsx'), 'Missing frontend route entry or landing page.');
  check('Project structure', 'Backend route aggregator exists', exists('server/src/routes/index.js'), 'Missing backend API route aggregator.');
  check('Project structure', 'Migration directory exists', exists('server/migrations'), 'Missing migrations directory.');
  check('Project structure', 'Main npm scripts include build and app audit', hasAll('package.json', [/"build":/, /"test:app":\s*"node scripts\/app-system-audit\.mjs"/]), 'package.json must expose build and test:app.');
}

function auditPublicAndAuthRoutes() {
  check('Public and auth routes', 'Landing, shop, tracking, and verify email pages are routed', hasAll('src/routes/index.tsx', [/path:\s*'\/'/, /path:\s*'\/shop\/:shopName'/, /path:\s*'\/track\/:token'/, /path:\s*'\/verify-email'/]), 'Public route coverage is incomplete.');
  check('Public and auth routes', 'Seller auth routes are exposed', hasAll('src/routes/seller.routes.tsx', [/\/seller\/login/, /\/seller\/register/, /path:\s*'\/seller'/, /path:\s*'dashboard'/]), 'Seller login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Buyer auth routes are exposed', hasAll('src/routes/buyer.routes.tsx', [/\/buyer\/login/, /\/buyer\/register/, /path:\s*'\/buyer'/, /path:\s*'dashboard'/]), 'Buyer login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Creator auth and dashboard routes are exposed', hasAll('src/routes/index.tsx', [/\/creator\/login/, /\/creator\/register/, /\/creator\/dashboard/]), 'Creator login, register, or dashboard route is missing.');
  check('Public and auth routes', 'Creator button is visible from the public app', hasAll('src/components/HeroSection.tsx', [/to="\/creator\/login"/, />\s*Creator\s*</]), 'Top-right Creator entry point is missing.');
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
    check('Backend route wiring', `${prefix} API is mounted`, routeMounted(prefix, routeName), `${prefix} is not mounted in server/src/routes/index.js.`);
  }

  check('Backend route wiring', 'Protected role routes apply auth middleware', hasAll('server/src/routes/seller.routes.js', [/router\.use\(protect\)/]) && hasAll('server/src/routes/buyer.routes.js', [/router\.use\(protect\)/]) && hasAll('server/src/routes/admin.routes.js', [/router\.use\(protect\)/]), 'Seller, buyer, and admin protected routes should apply auth middleware.');
  check('Backend route wiring', 'Admin creator API is exposed', hasAll('server/src/routes/admin.routes.js', [/\/creators/, /getAllCreators/]) && hasAll('server/src/services/admin.service.js', [/getAllCreators/, /totalCreators/]), 'Admin creator data route is missing.');
}

function auditBuyerExperience() {
  check('Buyer experience', 'Buyer login and registration screens exist', exists('src/components/buyer/BuyerLogin.tsx') && exists('src/components/buyer/BuyerRegister.tsx'), 'Buyer auth screens are missing.');
  check('Buyer experience', 'Buyer dashboard loads order, refund, and followed shop flows', hasAll('src/components/buyer/BuyerDashboard.tsx', [/OrdersSection/, /useBuyerFollowedShops/, /MyShopsSection/]) && hasAll('src/components/buyer/dashboard/BuyerProfileSheet.tsx', [/RefundCard/]), 'Buyer dashboard is missing order/refund/followed shop coverage.');
  check('Buyer experience', 'Buyer API supports orders, refunds, clients, and wishlist-related flows', hasAll('src/api/buyerApi.ts', [/orders/i, /refund/i, /leaveClient/, /wishlist/i]), 'Buyer API coverage is incomplete.');
  check('Buyer experience', 'Public shop page exposes seller products and client count', hasAll('src/pages/ShopPage.tsx', [/sellerInfo/, /products/, /clientCount/]), 'Shop page contract is incomplete.');
}

function auditSellerExperience() {
  check('Seller experience', 'Seller dashboard exposes all main tabs', hasAll('src/components/seller/dashboard/dashboardUtils.ts', [/overview/, /products/, /orders/, /withdrawals/, /settings/]), 'Seller dashboard tab list is incomplete.');
  check('Seller experience', 'Seller overview shows creator metrics', hasAll('src/components/seller/dashboard/tabs/OverviewTab.tsx', [/Creator sales/, /Creators/, /creatorGeneratedSales/, /creatorCount/]), 'Seller overview should include creator count and creator-generated sales.');
  check('Seller experience', 'Seller settings support banner, theme, locations, and creator invites', hasAll('src/components/seller/dashboard/tabs/SettingsTab.tsx', [/BannerUpload/, /Theme/, /Location Settings/, /Invite Creators/]), 'Seller settings coverage is incomplete.');
  check('Seller experience', 'Seller product form enforces minimum price and service charge explanation', hasAll('server/src/services/product.service.js', [/Fees\.PRODUCT_MIN_PRICE/]) && hasAll('src/components/seller/dashboard/tabs/ProductsTab.tsx', [/2% service charge/i, /safe in transit/i]), 'Seller product pricing/service charge messaging needs review.');
  check('Seller experience', 'Seller withdrawals apply minimum and tiered fees', hasAll('src/components/seller/dashboard/dashboardUtils.ts', [/MIN_WITHDRAWAL_AMOUNT\s*=\s*50/, /WITHDRAWAL_FEE_TIERS/, /1500/, /20000/, /63/]), 'Seller withdrawal fee rules are missing or changed.');
}

function auditCreatorExperience() {
  check('Creator experience', 'Creators can register by invite or directly', hasAll('server/src/controllers/creator.controller.js', [/registerFromInvite/, /registerDirect/]) && hasAll('src/pages/creator/CreatorRegister.tsx', [/readOnly=\{Boolean\(token\)\}/, /Create creator account/]), 'Creator registration should support both invite and direct signup.');
  check('Creator experience', 'Creators are email verified before login', hasAll('server/src/services/creator.service.js', [/sendEmailVerification\(email,\s*'creator'\)/, /AuthService\.login\(email,\s*password,\s*'creator'\)/]), 'Creator verification/login guard is incomplete.');
  check('Creator experience', 'Creator auth captures WhatsApp and supports password visibility', hasAll('src/pages/creator/CreatorRegister.tsx', [/whatsappNumber/, /WhatsApp number/, /EyeOff/, /Creator login/]) && hasAll('src/pages/creator/CreatorLogin.tsx', [/showPassword/, /EyeOff/]), 'Creator auth should collect WhatsApp details and expose password visibility controls.');
  check('Creator experience', 'Creator dashboard has requests, linked shops, leaderboard, clicks, withdrawals, logout, and period analysis', hasAll('src/pages/creator/CreatorDashboard.tsx', [/Shop requests/, /Linked shops/, /Top creators/, /Link clicks/, /Withdraw to M-Pesa/, /LogOut/, /daily/, /weekly/, /monthly/, /Sales value/]) && hasAll('server/src/routes/creator.routes.js', [/\/logout/]), 'Creator dashboard analytics or logout coverage is incomplete.');
  check('Creator experience', 'Creator referral links invite sellers', hasAll('src/pages/creator/CreatorDashboard.tsx', [/\/seller\/register\?ref=/, /Copy seller link/]), 'Creator seller referral link is missing.');
  check('Creator experience', 'Creator backend tracks requests, clicks, earnings, referrals, and withdrawals', hasAll('server/src/services/creator.service.js', [/respondToShopRequest/, /recordLinkClick/, /creditCreatorForOrder/, /creditCreatorReferralForSeller/, /createWithdrawalRequest/]) && hasAll('server/src/routes/creator.routes.js', [/shop-requests\/:inviteId\/accept/, /shop-requests\/:inviteId\/deny/]), 'Creator backend flow coverage is incomplete.');
  check('Creator experience', 'Creator sale notifications are wired to WhatsApp', hasAll('server/src/services/creator.service.js', [/notifyCreatorSaleSuccess/, /whatsapp_number/, /sendMessage/]) && migrationIncludes(/ALTER TABLE creators[\s\S]*whatsapp_number/), 'Creator successful-sale WhatsApp notification wiring is missing.');
}

function auditCheckoutAndPayments() {
  check('Checkout and payments', 'Checkout uses idempotency and provider payment initiation', hasAll('server/src/controllers/payment.controller.js', [/idempotency-key/i, /initiateProductPayment/]) && hasAll('server/src/services/payment.service.js', [/payment_method:\s*provider/, /providerClient/]), 'Payment initiation/idempotency contract is incomplete.');
  check('Checkout and payments', 'Paystack webhook fails closed with HMAC verification', hasAll('server/src/middleware/paystackWebhookSecurity.js', [/x-paystack-signature/, /verifyPaystackHmacSignature/, /Invalid webhook payload/]), 'Webhook security is incomplete.');
  check('Checkout and payments', 'Payment completion is centralized and atomic', hasAll('server/src/core/CorePaymentService.js', [/completeVerifiedPayment/, /BEGIN/, /COMMIT/, /ROLLBACK/, /eventBus\.enqueueInTransaction/]), 'Core payment completion should remain centralized and transactional.');
  check('Checkout and payments', 'Buyer-facing payment modal hides service charge wording', !matches('src/components/PaymentStatusModal.tsx', /service charge/i), 'Buyer payment modal should not mention service charge.');
  check('Checkout and payments', 'Receipts do not mention buyer service charge', !matches('server/src/shared/utils/email.js', /service charge/i), 'Buyer/seller receipt templates should be reviewed for service charge wording.');
}

function auditOrdersInventoryAndEscrow() {
  check('Orders, inventory, and escrow', 'Physical products without inventory are marked sold out after paid sale', hasAll('server/src/services/inventoryReservation.service.js', [/COALESCE\(p\.track_inventory,\s*false\) = false/, /SET status = 'sold'/]), 'Physical no-inventory sold-out protection is missing.');
  check('Orders, inventory, and escrow', 'Double purchase prevention uses locking/reservations', hasAny('server/src/core/CorePaymentService.js', [/FOR UPDATE/, /reserved_quantity/, /releaseOrderReservations/]) && hasAny('server/src/services/payment.service.js', [/reserved_quantity/, /FOR UPDATE/]), 'Inventory reservation/locking needs review.');
  check('Orders, inventory, and escrow', 'Escrow release credits seller once', hasAll('server/src/services/EscrowManager.js', [/ON CONFLICT \(order_id\) DO NOTHING/, /UPDATE sellers/]), 'Escrow payout idempotency is missing.');
  check('Orders, inventory, and escrow', 'Order status guard protects state transitions', hasAll('server/src/shared/utils/OrderStatusGuard.js', [/assertValidTransition/, /Illegal state transition/, /\[OrderStatus\.COMPLETED\]: \[\]/, /\[OrderStatus\.CANCELLED\]: \[\]/]), 'Order state transition guard is incomplete.');
}

function auditLogisticsAndTracking() {
  check('Logistics and tracking', 'Mzigo/logistics routes and pages exist', hasAll('src/routes/index.tsx', [/\/mzigo\/login/, /\/mzigo\/dashboard/, /\/logistics\/login/, /\/logistics\/dashboard/]) && routeMounted('/logistics', 'logisticsRoutes'), 'Logistics UI or API route is missing.');
  check('Logistics and tracking', 'Physical shop pickup avoids Mzigo when buyer does not choose delivery', hasAll('server/src/services/payment.service.js', [/hasPhysicalShop|physical/i, /wantsDoorDelivery/]) && hasAll('server/src/shared/utils/fulfillment.js', [/physical/i, /delivery/i]), 'Physical-shop pickup logic needs review.');
  check('Logistics and tracking', 'Door delivery and seller pickup activate only after payment completion', hasAll('server/src/events/payment.events.js', [/AppEvents\.PAYMENT\.COMPLETED/, /activateDoorDeliveryAfterPayment/, /activateSellerPickupAfterPayment/]), 'Logistics payment completion hook is missing.');
  check('Logistics and tracking', 'Public tracking links are tokenized and routed', hasAll('server/src/services/logisticsTrackingLink.service.js', [/buildToken/, /getSafeTrackingByToken/]) && hasAll('src/pages/TrackingPage.tsx', [/Timeline/, /ETA/]), 'Public tracking link coverage is incomplete.');
}

function auditAdminAndOperations() {
  check('Admin and operations', 'Admin dashboard routes and data APIs exist', hasAll('src/pages/admin/NewDashboardPage.tsx', [/AdminOverviewTab/, /logistics/i, /withdrawal/i, /clients/i]) && routeMounted('/admin', 'adminRoutes'), 'Admin dashboard coverage is incomplete.');
  check('Admin and operations', 'Admin can inspect payouts, balances, sellers, creators, buyers, clients, and logistics', hasAll('server/src/controllers/admin.controller.js', [/getAllWithdrawalRequests/, /getPaymentProviderBalances/, /getAllSellers/, /getAllCreators/, /getAllBuyers/, /getAllClients/, /getAdminLogisticsRequests/]) && hasAll('src/pages/admin/components/AdminDashboardTabs.tsx', [/Creators/]) && hasAll('src/pages/admin/NewDashboardPage.tsx', [/Creator Network/, /linkedShops/, /totalCreatorEarnings/]), 'Admin controller is missing an operational surface.');
  check('Admin and operations', 'Marketing dashboard route exists', routeMounted('/admin/marketing', 'marketingRoutes') && hasAll('src/routes/index.tsx', [/\/admin\/marketing\/login/, /\/admin\/marketing/]), 'Marketing route coverage is incomplete.');
}

function auditFeesAndBusinessRules() {
  check('Fees and business rules', 'Backend fees match current business rules', hasAll('server/src/config/fees.js', [/PRODUCT_MIN_PRICE:\s*50/, /PRODUCT_SERVICE_CHARGE_RATE:\s*0\.02/, /PLATFORM_COMMISSION_AMOUNT:\s*10/, /CREATOR_COMMISSION_RATE:\s*0\.01/, /REFERRAL_REWARD_PER_PRODUCT:\s*3/, /MIN_WITHDRAWAL_AMOUNT:\s*50/, /fee:\s*21/, /fee:\s*45/, /fee:\s*63/]), 'Backend fee config no longer matches agreed rules.');
  check('Fees and business rules', 'Frontend seller withdrawal fees match backend tiers', hasAll('src/components/seller/dashboard/dashboardUtils.ts', [/fee:\s*21/, /fee:\s*45/, /fee:\s*63/]), 'Seller withdrawal frontend fee tiers need review.');
  check('Fees and business rules', 'Creator withdrawal fees require balance to cover charge', hasAll('src/pages/creator/CreatorDashboard.tsx', [/withdrawalFee/, /totalDeduction/, /balance < totalDeduction/]) && hasAll('server/src/services/creator.service.js', [/calculateWithdrawalFee/, /totalDeducted/, /balance.*totalDeducted/s]), 'Creator withdrawal fee/balance protection is incomplete.');
}

function auditDatabaseMigrations() {
  check('Database migrations', 'Creator program schema migration exists', migrationIncludes(/CREATE TABLE IF NOT EXISTS creators/) && migrationIncludes(/seller_creator_links/) && migrationIncludes(/creator_earnings/), 'Creator program migration is missing core tables.');
  check('Database migrations', 'Creator growth migration exists', migrationIncludes(/creator_link_clicks/) && migrationIncludes(/creator_withdrawal_requests/) && migrationIncludes(/referred_by_creator_id/), 'Creator growth migration is missing.');
  check('Database migrations', 'Logistics tracking migration exists', migrationIncludes(/CREATE TABLE IF NOT EXISTS logistics_tracking_links/), 'Logistics tracking migration is missing.');
  check('Database migrations', 'Payment and withdrawal hardening migrations exist', migrationIncludes(/webhook_replay_dedupe/) && migrationIncludes(/withdrawal_requests_seller_idempotency_unique/), 'Payment/withdrawal hardening migrations are missing.');
  check('Database migrations', 'Schema check covers operational tables', hasAll('server/src/loaders/schemaCheck.js', [/withdrawal_requests/, /logistics_tracking_links/, /payout_provider_attempts/]), 'Runtime schema checks are missing critical tables.');
}

function auditSecurityAndRecovery() {
  check('Security and recovery', 'Auth middleware supports role-scoped sessions and cross-role creator access', hasAll('server/src/middleware/auth.js', [/creatorId/, /cross-roles|crossRoles|crossRole/i]) && hasAll('server/src/services/auth.service.js', [/type === 'creator'/, /signToken\(user\.id,\s*'creator'/]), 'Role auth needs review.');
  check('Security and recovery', 'Rate limiting protects auth and payments', hasAll('server/src/middleware/rateLimiting.js', [/paymentRateLimiter/, /auth|login/i]) && hasAll('server/src/middleware/authRateLimiter.js', [/rateLimit/]), 'Rate limiting coverage is incomplete.');
  check('Security and recovery', 'Payment and fulfillment recovery workers exist', exists('server/src/cron/paymentCron.js') && exists('server/src/cron/fulfillmentWorker.js') && hasAll('server/src/index.js', [/scheduleFulfillmentRetry/, /events\/payment\.events/]), 'Recovery workers/events are missing.');
  check('Security and recovery', 'Sensitive public sanitizers exist', hasAll('server/src/shared/utils/sanitize.js', [/sanitizeBuyer/, /sanitizeSeller/, /sanitizeOrder/]), 'Sanitization helpers need review.');
}

function auditFrontendBuildCoverage() {
  const routeFiles = ['src/routes/index.tsx', 'src/routes/seller.routes.tsx', 'src/routes/buyer.routes.tsx'];
  for (const path of routeFiles) {
    check('Frontend route coverage', `${path} exists`, exists(path), `${path} is missing.`);
  }

  check('Frontend route coverage', 'Core dashboards are lazy-loadable or directly imported', hasAll('src/routes/index.tsx', [/CreatorDashboard/, /MzigoDashboard/, /MarketingDashboard/]) && hasAll('src/routes/seller.routes.tsx', [/SellerDashboard/]) && hasAll('src/routes/buyer.routes.tsx', [/BuyerDashboard/]), 'A dashboard route import is missing.');
  check('Frontend route coverage', 'API client redirects protected creator routes to creator login', hasAll('src/lib/apiClient.ts', [/\/creators/, /\/creator\/login/]), 'API client creator auth redirect is missing.');
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
