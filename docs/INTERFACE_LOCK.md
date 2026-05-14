# Byblos Interface Protection Lock

This document records the runtime contracts that must be protected during refactors. It is intentionally about interfaces and invariants, not implementation style. Runtime behavior must not change unless the related contract, migration, tests, and frontend callers are updated together.

## Interface Lock Document

### Active API Surface

All backend routes are mounted under `/api` by `server/src/loaders/express.js` and `server/src/routes/index.js`.

| Area | Public contract |
| --- | --- |
| Health | `GET /api/health` |
| Buyer auth | `POST /api/buyers/register`, `POST /api/buyers/login`, `POST /api/buyers/forgot-password`, `POST /api/buyers/reset-password`, `GET /api/buyers/verify-email`, `POST /api/buyers/resend-verification`, `POST /api/buyers/check-phone`, `POST /api/buyers/save-info`, `POST /api/buyers/auto-login`, `POST /api/buyers/logout` |
| Buyer protected | `GET /api/buyers/profile`, `PATCH /api/buyers/update-profile`, `POST /api/buyers/refund-request`, `GET /api/buyers/refund-requests/pending`, `POST /api/buyers/orders/:orderId/collected`, `GET/POST/DELETE /api/buyers/wishlist`, `GET /api/buyers/shops`, `POST /api/buyers/sellers/:sellerId/become-client`, `POST /api/buyers/sellers/:sellerId/leave-client` |
| Seller auth | `POST /api/sellers/register`, `POST /api/sellers/login`, `POST /api/sellers/forgot-password`, `POST /api/sellers/reset-password`, `GET /api/sellers/verify-email`, `POST /api/sellers/resend-verification`, `POST /api/sellers/logout` |
| Seller public | `GET /api/sellers/check-shop-name`, `GET /api/sellers/shop/:shopName`, `GET /api/sellers/search`, `GET /api/sellers/:sellerId/products` |
| Seller protected | `GET /api/sellers/profile`, `PATCH /api/sellers/profile`, `POST /api/sellers/upload-banner`, `POST /api/sellers/upload-business-photo`, `PATCH /api/sellers/theme`, `GET /api/sellers/analytics`, `GET /api/sellers/:id`, `PATCH /api/sellers/products/:id/inventory`, `POST /api/sellers/products/upload-digital`, `POST /api/sellers/withdrawal-request`, `GET /api/sellers/withdrawal-requests`, `GET /api/sellers/withdrawal-requests/:id`, seller referral routes |
| Public catalog | `GET /api/public/csrf-token`, `GET /api/public/aesthetics`, `GET /api/public/products`, `GET /api/public/products/:id`, `GET /api/public/sellers/active`, `POST /api/public/sellers/:id/knock`, `GET /api/public/sellers/:id/public`, `GET /api/public/services/:productId/availability`, `GET /api/public/orders/:id/status` |
| Payments | `POST /api/payments/initiate-product`, `POST /api/payments/webhook/payd`, `GET /api/payments/status/:invoiceId` |
| Payment admin health | `GET /api/payments/health/payd-agent`, `POST /api/payments/health/payd-agent/reset`, `GET /api/payments/health/network` |
| Payout callbacks | `POST /api/callbacks/payd-payout` |
| Orders | `GET /api/orders/reference/:reference`, protected `POST /api/orders`, `GET /api/orders/user`, `GET /api/orders/seller`, `GET /api/orders/:id`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/confirm-receipt`, `PATCH /api/orders/:id/cancel`, `PATCH /api/orders/:id/seller-cancel`, `GET /api/orders/:orderId/download/:productId`, `POST /api/orders/location-preview` |
| Admin | `POST /api/admin/login`, `POST /api/admin/logout`, protected admin dashboards, seller/buyer/product management, payment processing, financial metrics, withdrawal request review |
| Marketing admin | `POST /api/admin/marketing/login`, protected marketing overview, GMV trend, user growth, product mix, funnel, geography, performers, referrals, activity |
| Refunds | Protected admin `GET /api/refunds`, `GET /api/refunds/:id`, `PATCH /api/refunds/:id/confirm`, `PATCH /api/refunds/:id/reject` |
| Auth refresh | `POST /api/auth/refresh-token` |
| Wishlist | Protected `GET /api/wishlist`, `POST /api/wishlist`, `DELETE /api/wishlist/:productId` |
| WhatsApp ops | `GET /api/whatsapp/status`, protected `GET /api/whatsapp/qr`, `POST /api/whatsapp/initialize`, `POST /api/whatsapp/logout`, `POST /api/whatsapp/test` |

### Shared Type Contracts

Backend runtime enums live in `server/src/shared/constants/enums.js` and are database-facing contracts:

| Contract | Locked values |
| --- | --- |
| `PaymentStatus` | `pending`, `completed`, `failed`, `cancelled`, `success`, `paid`, `manual_review_required`, `payment_mapping_failed`, `compensation_required` |
| `OrderType` | `PHYSICAL`, `SERVICE`, `DIGITAL` |
| `ProductType` | `physical`, `digital`, `service` |
| `SellerStatus` | `active`, `inactive`, `suspended` |

Frontend shared contracts live in:

- `src/types/index.ts`
- `src/types/order.ts`
- `src/types/components.ts`
- `src/contexts/auth/authTypes.ts`
- `src/api/seller/types.ts`

The frontend API modules are also interface boundaries:

- `src/api/adminApi.ts`
- `src/api/buyerApi.ts`
- `src/api/publicApi.ts`
- `src/api/sellerApi.ts`
- `src/api/seller/profileApi.ts`
- `src/api/seller/productsApi.ts`
- `src/api/seller/ordersApi.ts`
- `src/api/seller/withdrawalsApi.ts`
- `src/api/public/sellerTransforms.ts`
- `src/api/public/productTransforms.ts`

Do not rename fields returned by backend APIs without updating these frontend transforms and the dashboard/payment modal consumers.

### DB-Dependent Logic

Startup schema verification is a production contract in `server/src/loaders/schemaCheck.js`. A database that lacks critical fintech structures must not boot.

Critical tables:

- `fraud_events`
- `event_outbox`
- `event_dedupe`
- `event_recipient_deliveries`
- `webhook_replay_dedupe`
- `fulfillment_jobs`
- `withdrawal_requests`
- `payout_provider_attempts`
- `payout_reconciliation_events`
- `payments`
- `product_orders`

Critical constraints and indexes:

- `withdrawal_requests_seller_idempotency_unique`
- `product_orders_client_checkout_token_unique_all`
- `payouts_order_id_unique`
- `fulfillment_jobs_order_id_unique`
- `payment_provider_attempts_payment_unique`
- `payment_provider_attempts_api_ref_unique`
- `payout_provider_attempts_request_unique`
- `payout_provider_attempts_idempotency_unique`
- `payout_provider_attempts_provider_reference_unique`
- `withdrawal_requests_provider_reference_unique`
- `payout_reconciliation_events_unique_reference`
- `payout_reconciliation_events_global_reference_unique`
- `event_recipient_deliveries_unique`
- retry indexes for `event_outbox`, `event_recipient_deliveries`, and `webhook_replay_dedupe`

Critical column contracts:

- `product_orders.client_checkout_token` is mandatory and unique.
- `withdrawal_requests.idempotency_key` is mandatory per seller idempotency.
- `withdrawal_requests.retry_started_at` and `withdrawal_requests.retry_worker_id` support retry leases.
- `payments.status` and `product_orders.payment_status` must use the shared `payment_status` enum.
- `service_slots.expires_at` is the service-slot expiry column. `reserved_until` must not reappear.

### Webhook Contracts

Payment webhooks:

- Endpoint: `POST /api/payments/webhook/payd`
- Middleware order: `verifyPaydWebhook`, rate limiter, `requirePaydWebhookHmac`, controller.
- Must use raw body HMAC validation.
- Must require `x-payd-signature`.
- Must fail closed for missing signature, invalid signature, malformed JSON, invalid timestamp, replay conflict, or unavailable replay protection.
- Must accept provider references through the shared `normalizeProviderReference()` helper, including `api_ref`.

Payout callbacks:

- Endpoint: `POST /api/callbacks/payd-payout`
- Same HMAC and replay protection level as payment webhooks.
- Must not mutate withdrawal state before webhook authentication and replay protection finish.
- Must use locked payout state transitions for delayed provider success, failure, refund, and compensation states.

Webhook replay protection:

- Backed by `webhook_replay_dedupe`.
- Replayed completed callbacks should be idempotent.
- Concurrent duplicate callbacks should not mutate state twice.

### Payment Calculation Contracts

Fee configuration lives in `server/src/config/fees.js`:

- Platform commission: `1%`
- Referral reward: `KES 3 per product sold by a referred seller for 3 months`
- Minimum withdrawal: `KES 50`
- Maximum withdrawal: `KES 250,000`
- Currency: `KES`

Payment amount invariants:

- Client-provided product totals are not trusted.
- Product checkout amount is computed from database product price and quantity.
- Order total, platform fee, and seller payout are derived in order logic from database-backed item prices.
- Payment completion requires provider amount confirmation.
- Provider amount must not fall back to `payment.amount`.
- Amount mismatch beyond `KES 1` must prevent completion and persist fraud evidence.

Payment completion contract:

- All payment success paths must route through `CorePaymentService.completeVerifiedPayment()`.
- Completion must lock the payment row.
- Completion must resolve order id only from `metadata.order_id` or `metadata.product_order_id`.
- Completion must lock the order row before order mutation.
- Payment update, order update, and fulfillment enqueue must be atomic.
- Fulfillment enqueue must be idempotent through `fulfillment_jobs` uniqueness.

### Frontend/Backend Coupling

High-coupling surfaces:

- Buyer dashboard shop cards depend on `/api/public/sellers/active`, seller transforms, theme colors, profile photo, bio, follower count, wishlist count, click count, and online/physical shop flags.
- Buyer followed shops depend on buyer follow endpoints and the same seller card contract.
- Product purchase modal depends on `/api/payments/initiate-product`, checkout token enforcement, product name, shop name, product price, delivery details, and final total.
- Seller dashboard depends on seller profile, products, orders, withdrawals, analytics, theme, Cloudinary business photo, and shop location fields.
- Seller shop pages depend on public seller profile, theme color, business photo/avatar, bio, physical/online status, products, and service availability.
- Auth providers depend on backend profile, token refresh, route role checks, and session invalidation behavior.

Frontend route guards are not financial security boundaries. Backend auth and role middleware remain authoritative.

## Non-Negotiable Behaviors List

1. Webhooks and payout callbacks fail closed without valid HMAC and replay protection.
2. Provider-originated payment lookups never match internal numeric ids.
3. Payment completion never uses database amount as a substitute for provider amount.
4. Payment metadata never treats `product_id` as an order id.
5. Payment/order/fulfillment writes stay in one transaction.
6. Failed payment cleanup releases physical reservations and service slots atomically.
7. Service slots use `expires_at`, not `reserved_until`.
8. Checkout requires a stable idempotency token.
9. Duplicate checkout retries return or protect the existing order/payment rather than creating a second checkout.
10. Withdrawal creation requires idempotency and locks seller balance before debit.
11. Payout retries use leases and `FOR UPDATE SKIP LOCKED`.
12. Delayed provider success after refund moves to compensation/manual review, never silent success.
13. External notifications do not run inside financial DB transactions.
14. Durable outbox is used for important post-commit lifecycle events.
15. Recipient notification delivery tracks per-recipient success/failure.
16. Inventory release never makes `reserved_quantity` negative.
17. Digital products are skipped by physical reservation accounting.
18. Fulfillment queue jobs are idempotent and recoverable.
19. Startup must fail when fintech schema contracts are missing.
20. Frontend auth state must revalidate on expiry, focus/visibility regain, and role-sensitive route changes.

## Regression-Sensitive Systems List

| System | Why it is sensitive | Guard checks |
| --- | --- | --- |
| Payment completion | Real money, order state, fulfillment, inventory, fraud evidence | Search for DB amount fallbacks, direct completed writes, ambiguous refs, old handlers |
| Payd webhook middleware | External write trigger | Verify raw body HMAC, replay dedupe, timestamp, and reference normalization |
| Payout callbacks | Wallet/provider divergence risk | Verify locked state machine, compensation states, callback HMAC, idempotency |
| Checkout idempotency | Duplicate order/payment risk under retries and Redis outage | Verify mandatory token, DB uniqueness, same-token retry behavior |
| Inventory reservation/release | Oversell and stuck slot risk | Verify row locks, negative guards, digital skips, service slot `expires_at` cleanup |
| Fulfillment queue | Double fulfillment and orphan jobs | Verify unique jobs, claim locking, retry/recovery behavior |
| Event outbox | Duplicate or lost notifications | Verify per-recipient records, retry backoff, dead-letter behavior |
| Auth providers | Stale privileged frontend state | Verify React Query cache, role isolation, token refresh, route guard behavior |
| Buyer/seller dashboards | API fanout, stale cache, render storms | Verify pagination, query keys, no mirrored stale state, no broad polling |
| Schema migrations | Partial migration boot risk | Verify startup schema check and enum/constraint alignment |

## Verification Commands

Run these after changing any protected interface:

```powershell
npx madge --extensions js --circular server/src
npx madge --extensions ts,tsx --circular src
node --test server/test/payment-remediation.static.test.js
node --test server/test/fintech-remediation.integration.test.js
npx vitest run src/components/dashboard-render-cache.integration.test.tsx src/contexts/AuthCoreContext.integration.test.tsx --environment jsdom
npm run build
```

Targeted safety searches:

```powershell
rg "\?\? payment\.amount|\|\| payment\.amount|providerData\?\.amount \?\?" server/src
rg "id::text|metadata\.product_id|product_id.*order_id" server/src
rg "reserved_until" server/src server/migrations
rg "verifyWebhookSignature.*true|fallback.*true" server/src
rg "status\s*=\s*'completed'|payment_status\s*=\s*'paid'" server/src
```

Route and coupling inspection:

```powershell
rg "router\.(get|post|put|patch|delete)|router\.use" server/src/routes
rg "completeVerifiedPayment" server/src
rg "normalizeProviderReference|normalizeProviderAmount|normalizeProviderPaymentStatus" server/src
rg "client_checkout_token|idempotency_key|FOR UPDATE SKIP LOCKED" server/src
```
