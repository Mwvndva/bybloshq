# Design: Restore product-checkout payment initiation (focused port)

- **Date:** 2026-08-29
- **Status:** Draft for review
- **Author:** Claude (paired with maintainer)
- **Area:** `server/` payments domain (money-handling; security-sensitive)

## 1. Problem

Product checkout is dead end-to-end. The public initiation endpoint the frontend
calls returns HTTP 500:

```
POST /api/payments/initiate-product
  → payment.controller.initiateProductPayment          (intact)
  → paymentService.initiateProductPayment              (delegates)
  → CorePaymentService.initiateProductPayment          → throw 'is disabled'
```

The alternative `POST /api/orders` returns 410 ("retired — use
/api/payments/initiate-product"), and the intended replacement
`CheckoutWorkflow.createOrder` is unfinished (writes to a non-existent `orders`
table — the real table is `product_orders` — and performs **no** Paystack
charge). Net effect: **no buyer can start or complete a purchase.** Verified live
against the Render backend and confirmed in current `main`.

### Root cause

`CorePaymentService.initiateProductPayment` was historically a thin
lock-and-delegate wrapper around
`paymentLifecycleService.initiateProductPaymentLegacy(...)`. The DDD refactor
(a) replaced the wrapper with a `throw` (commit `4b4c4b0f`) and (b) later
**deleted** the 1930-line `paymentLifecycle.service.js` that held the real
logic, without landing a replacement. The recovered source of the working
method is preserved (git blob `6d0ec454…`, from `0bf749b9^`) and is the
authoritative reference for money behavior in this port.

## 2. Goal / non-goals

**Goal:** A guest or authenticated buyer can complete a real M-Pesa (Paystack
mobile-money) purchase: initiation creates the order + pending payment, calls
Paystack, and the existing (working) `charge.success` webhook path
(`completeVerifiedPayment`) settles it and fulfills the order.

**Non-goals (this spec):**
- Rebuilding `CheckoutWorkflow` / the aborted `orders`-table design.
- Changing the webhook/completion path (already verified working).
- Changing fees, payout, or fulfillment *behavior* — port faithfully, do not
  "improve" money math.
- Card payments or non-Paystack providers.

## 3. Approach — focused port

Port only the product-initiation orchestration from the recovered legacy service
into a single focused service in the current DDD structure, reusing building
blocks that still exist, and re-wire the existing (intact) controller/service
delegation to it. Use the recovered legacy method as the authoritative spec for
money math, metadata shape, and reference linkage.

### 3.1 Dependency map (verified in current tree)

**Reuse as-is (exist):**
- `PaystackProviderClient.initiatePayment(...)` — the real mobile-money charge.
- `fees.js` → `calculateProductServiceCharge`, `Fees` config (2% buyer service charge).
- `creator.service.resolveAttribution(...)`.
- `logisticsQuote.service.quoteBuyerDoorDelivery(...)`,
  `logisticsRequest.service.createDoorDeliveryPaymentPending(...)`.
- `order.model` (INSERT INTO `product_orders`) — order-row creation.
- `completeVerifiedPayment` (webhook/cron settlement) — unchanged.
- `payments`, `product_orders`, `payment_provider_attempts` tables (present in schema).

**Must port (deleted with the legacy service):**
- The payment-provider-attempt lifecycle: `createPaymentProviderAttempt`,
  `markPaymentProviderAttemptStarted/Accepted/Failed/Ambiguous`.
- Ambiguity/failure settlement: `markPaymentInitiationAmbiguous`,
  `markPaymentInitiationFailed`, `isAmbiguousPaymentProviderError`.
- Module-level money/validation helpers: `roundMoney`, `roundPayableTotal`,
  `normalizeCustomInstructions`, `isDoorDeliveryRequested`,
  `extractDeliveryLocation`, `assertDoorDeliveryLocation`,
  `PRODUCT_SERVICE_CHARGE_RATE`.

### 3.2 New units (small, focused files)

- `server/src/domains/payments/payments/productCheckout.service.js`
  — `ProductCheckoutService.initiateProductPayment(normalizedOrder)`: the
  orchestration (validate → price → idempotency → create order+payment+attempt
  in one tx → COMMIT → charge → settle attempt state).
- `server/src/domains/payments/payments/paymentProviderAttempt.service.js`
  — the provider-attempt lifecycle + ambiguity/failure helpers (ported).
- Small `checkoutPricing.js` (or co-located helpers) for the pure money helpers,
  so they are unit-testable in isolation.

### 3.3 Wiring

Replace the disabled delegation so
`paymentService.initiateProductPayment(normalizedOrder)` calls
`ProductCheckoutService.initiateProductPayment(normalizedOrder)`. The controller,
route, CSRF, rate limiting, and `normalizeOrderInput` are all intact and
unchanged. The redis lock (`lock:payment:initiate:${orderId}`) from the original
wrapper is preserved.

## 4. Behavior (ported algorithm)

Input: `normalizedOrder = { buyer{id,email,phone,name}, service{id,quantity}, location, metadata, idempotencyKey }`.

1. **Resolve & validate** product JOIN seller; require `seller.status = 'active'`
   and `product.status = 'available'`.
2. **Secure pricing (backend-owned; ignore any client `amount`):**
   - `productSubtotal = round(price × quantity)`
   - product-type flags: digital / service / physical / custom / imported, with
     the same config guards (custom → `production_days ∈ [1..5]` + required
     customization instructions; imported → `import_days ∈ {7,14,21,30}`; not both).
   - door delivery (physical only): quote via `LogisticsQuoteService` →
     `buyerDeliveryFee`.
   - `serviceCharge = calculateProductServiceCharge(productSubtotal)` (2%)
   - `payableTotal = round(productSubtotal + buyerDeliveryFee + serviceCharge)`; must be > 0.
3. **Idempotency:** if a `product_orders` row already exists for
   `client_checkout_token = idempotencyKey`, return the existing
   order/payment/reference (idempotent replay).
4. **Creator attribution** via `CreatorService.resolveAttribution`.
5. **Transaction (BEGIN):** create `product_orders` (via order model, PENDING);
   `api_ref = BYB-${order.id}-${Date.now()}`; INSERT `payments` (status
   `pending`, `api_ref`, full pricing metadata incl. `order_id`); if door
   delivery, create logistics payment-pending records; create provider-attempt
   row; **COMMIT**.
6. **Initiate gateway (post-commit):** `markProviderAttemptStarted` →
   `PaystackProviderClient.initiatePayment(gwPayload)` →
   `markProviderAttemptAccepted({ providerReference })`.
7. **Ambiguity/failure:** on ambiguous provider result or reference-persistence
   failure, leave payment `pending` and record ambiguous state (webhook/cron will
   settle) — never mark paid here. On a clear failure, mark payment/order failed
   and release reservations.
8. **Return** `{ success, orderId, orderNumber, paymentId, paymentResult:{ reference, status } }`.

### Reference linkage (must match the working webhook path)
- `payments.api_ref = BYB-<orderId>-<ts>`; `payments.provider_reference` set from
  the Paystack response on accept; `payments.metadata.order_id` links to the order.
- The verified `charge.success` webhook resolves the payment by provider
  reference / api_ref and calls `completeVerifiedPayment`. This port must
  populate exactly these fields so settlement continues to work unchanged.

## 5. Money rules (invariants to preserve)
- All amounts computed server-side from the DB product price; client `amount` is
  never trusted.
- Buyer pays `productSubtotal + doorDeliveryFee(optional) + 2% serviceCharge`.
- `seller_payout_base = productSubtotal` (payout excludes delivery fee &
  service charge). Pricing metadata block ported verbatim (downstream payout and
  fulfillment read it).
- Currency `KES`; rounding via the ported `roundMoney`/`roundPayableTotal`.

## 6. Error handling
- Validation failures → thrown Errors surfaced by the controller's existing
  client-error mapping (e.g. "Product not found", "Seller is not accepting
  orders", "Customization instructions are required…").
- Provider ambiguity/persistence errors → payment stays `pending`, settled later
  by webhook/cron (fail-safe, never double-charge or false-complete).
- Redis lock prevents concurrent double-initiation per order.

## 7. Security
- Backend-owned pricing (no client-trusted totals).
- Route already CSRF-protected + rate-limited (unchanged).
- Guest checkout is intended/public; no auth added.
- `security-reviewer` pass required before merge (money + external provider call).

## 8. Testing strategy (TDD)
- **Unit (node:test):** pure pricing/validation helpers — subtotal, 2% service
  charge, payable total, custom/imported guards, door-delivery gating,
  idempotency key extraction. Fast, no DB.
- **Integration (test DB):** initiation with `PaystackProviderClient` **mocked**
  — assert `product_orders` + `payments` (pending) + `payment_provider_attempts`
  rows created with correct amounts/linkage inside one transaction; idempotent
  replay returns the same order; provider failure leaves payment `pending`.
  *(Requires the test schema to include the fintech tables — see Risks.)*
- **E2E (Render sandbox):** deploy to Render (test keys), drive the guest
  purchase (the flow already scripted), deliver the signed `charge.success`
  webhook, and assert via DB read-back that the order settles to paid/fulfilled.

## 9. Rollout & verification
1. Branch `fix/restore-product-checkout` off `main` (separate from test-env work).
2. TDD implement; `security-reviewer` + `code-reviewer` passes.
3. Deploy to Render; run the end-to-end guest purchase; verify DB rows.
4. The route is already broken (500), so restoring it is strictly net-positive;
   no feature flag needed. Rollback = revert the branch.

## 10. Risks / open questions
- **Test-schema completeness:** the committed `server/test/schema.sql` (from the
  lagging `byblos7`, 31 tables) lacks the fintech tables
  (`payment_provider_attempts`, etc.), so integration tests need a fuller schema.
  Options: (a) obtain a schema-only dump of the Render DB (58 tables) to replace
  `schema.sql`; (b) add the specific tables the tests touch. **Recommend (a).**
- **`order.model` createOrder contract:** confirm the current order model exposes
  a transaction-aware create that produces the same `product_orders` columns the
  legacy `OrderService.createOrder` did; adapt the call site if the signature
  differs.
- **`PaystackProviderClient.initiatePayment` payload shape:** confirm it accepts
  the `gwPayload` fields the legacy code passed (phone, amount, api_ref, email);
  adjust mapping if the current client differs.
- **M-Pesa test-mode completion:** Paystack test mode won't complete a real STK
  push; E2E completion is driven by our signed `charge.success` webhook (proven).

## 11. Out of scope
- Finishing/deleting `CheckoutWorkflow`; card payments; payout/fulfillment
  changes; frontend changes (it already targets the correct endpoint).
