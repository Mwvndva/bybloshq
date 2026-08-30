# Pre-implementation contract verification — product checkout restoration

- **Date:** 2026-08-29
- **Status:** Read-only audit (no code changed). Feeds the revised implementation plan.
- **Rule applied:** recovered legacy code is a *behavioral reference only*, not
  automatically authoritative. Current contracts are sourced from the live
  Render schema (58 tables) + current `main` source.

> **Headline:** The port is larger than "restore one method." Restoring checkout
> requires re-deriving order fields that the **deleted `OrderService.createOrder`**
> owned (fees split, `fulfillment_type`, `order_type`, initial status) *and*
> re-creating the payment-provider-attempt lifecycle — because everything
> downstream (fulfillment, payout, creator earnings, logistics, buyer/seller
> actions) reads those fields. The webhook settlement and provider client are
> compatible and can be reused unchanged.

Legend for **Match**: ✅ compatible · ⚠️ partial / needs adaptation · ❌ missing/broken.

---

## 1. `product_orders` + order creation API

- **Current contract:** table has flat, caller-supplied columns:
  `order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
  seller_payout_amount, payment_method, buyer_*, notes, metadata(jsonb),
  status, payment_status(enum), service_requirements, fulfillment_type(enum),
  delivery_location(jsonb), order_type(enum), total_quantity,
  reservation_expires_at, location_*, service_title, notification_sent,
  client_checkout_token(NOT NULL)`. `order.model` exposes a low-level
  `create(data)` that **requires** `order_number`, `seller_id`, `buyer_email`
  and inserts exactly those columns — it does **no** derivation.
- **Legacy contract:** the port's source (`initiateProductPaymentLegacy`) called
  `OrderService.createOrder(nestedOrderData, client)` — a **deleted** 1031-line
  orchestrator that took `{buyer, service, location, payment, metadata, sellerId}`
  and derived `platform_fee_amount`, `seller_payout_amount`, `fulfillment_type`,
  `order_type`, initial `status`, order-number generation, idempotency (`SELECT …
  FOR UPDATE` on `client_checkout_token`), and reservation.
- **Match:** ❌ (orchestrator deleted; only the dumb model insert remains).
- **Incompatibilities:** the derivations (fee split, fulfillment/order type,
  initial status, reservation, order-number gen, idempotent replay) have no home
  in current code.
- **Migration:** port `OrderService.createOrder`'s derivation into the new
  checkout service (or a focused `orderCreation` helper) that maps nested input →
  `order.model.create(data)`. Must set `client_checkout_token` (NOT NULL).
- **Regression risk:** **High.** Wrong `platform_fee_amount`/`seller_payout_amount`
  corrupts payout; wrong `fulfillment_type`/`order_type`/`status` breaks the
  lifecycle guard and every downstream action. Requires unit tests on the
  derivation and the recovered legacy as the numeric reference.

## 2. `payments` schema + model

- **Current contract:** columns `invoice_id, amount, currency, status(enum),
  payment_method, mobile_payment, whatsapp_number, email, metadata(jsonb),
  provider_reference, api_ref, mpesa_receipt, raw_response, created_at, updated_at`.
- **Legacy contract:** `INSERT INTO payments (invoice_id, email, mobile_payment,
  whatsapp_number, amount, status, payment_method, api_ref, metadata)`.
- **Match:** ✅ Every legacy insert column exists with the same name/type.
- **Incompatibilities:** none for the insert. (`provider_reference` is set later
  on provider-accept.)
- **Migration:** keep the legacy insert as-is; set `status='pending'`,
  `api_ref=BYB-<orderId>-<ts>`, `invoice_id=<orderId>`.
- **Regression risk:** **Low.**

## 3. `payment_provider_attempts` + lifecycle API

- **Current contract:** table exists — `payment_id(NOT NULL), order_id, api_ref
  (NOT NULL), idempotency_key, provider_reference, status(NOT NULL), attempts
  (NOT NULL), request_payload/response_payload/error_payload (jsonb NOT NULL),
  last_attempt_at, timestamps`. **No code** references it — the lifecycle methods
  were deleted.
- **Legacy contract:** `createPaymentProviderAttempt`,
  `markPaymentProviderAttemptStarted/Accepted/Failed/Ambiguous`,
  `isAmbiguousPaymentProviderError`, plus `markPaymentInitiationAmbiguous/Failed`.
- **Match:** ❌ (schema present, lifecycle code missing).
- **Incompatibilities:** NOT-NULL `*_payload` columns require default `'{}'`;
  legacy code already supplies these.
- **Migration:** port the lifecycle helpers into a focused
  `paymentProviderAttempt.service.js` matching the columns above.
- **Regression risk:** **Medium.** This is the fail-safe layer that keeps a
  payment `pending` on ambiguous provider responses (prevents double-charge /
  false-complete). Must be ported faithfully and unit-tested.

## 4. `PaystackProviderClient.initiatePayment()`

- **Current contract:** input `{ email, amount, invoice_id, phone|phone_number,
  narration|narrative, api_ref, metadata }`; POSTs `/charge` with
  `mobile_money{provider:'mpesa'}`; returns `{ success, reference,
  transaction_id, status, message, original_response }`; throws normalized errors.
- **Legacy contract:** built `gwPayload = { ...paymentData(invoice_id, api_ref,
  amount, email, metadata), phone, firstName, narration }`, used `result.reference`.
- **Match:** ✅ Input and return are compatible.
- **Incompatibilities:** `firstName` is ignored by the current client (harmless);
  email required (or `PAYSTACK_DEFAULT_EMAIL`) — guest email must be passed.
- **Migration:** reuse as-is; ensure a guest email is always provided.
- **Regression risk:** **Low**, pending confirmation of the `status` value the
  client returns for a test-mode M-Pesa charge (expect PENDING).

## 5. `completeVerifiedPayment()` (webhook settlement)

- **Current contract:** `completeVerifiedPayment({ dbClient, reference, paymentId,
  providerPayload, source })`. Resolves the payment by
  `WHERE provider_reference = $1 OR api_ref = $1 OR invoice_id = $1`, locks it
  `FOR UPDATE`, updates payment status + `provider_reference`, then transitions
  `product_orders` and dispatches durable events. **Verified working live**
  (accepted → deduped, row present in `webhook_replay_dedupe`).
- **Legacy contract:** initiation persisted `provider_reference` (on accept),
  `api_ref` (`BYB-…`), and `invoice_id=<orderId>`.
- **Match:** ✅ The port only has to populate those three identifiers; settlement
  is reused unchanged.
- **Incompatibilities:** none, provided the port sets `api_ref`+`invoice_id` at
  insert and `provider_reference` on provider-accept.
- **Regression risk:** **Low** — this is the half already proven end-to-end.

## 6. Order status enum + `OrderStatusGuard`

- **Current contract:** 30-value `order_status` enum; explicit transition map, e.g.
  `CREATED→[RESERVED,HELD,PAYMENT_PENDING,CANCELLED]`,
  `PAYMENT_PENDING→[PAID,CANCELLED,FAILED,EXPIRED]`,
  `PAID→[AWAITING_SELLER_ACTION,FULFILLMENT_PENDING,DELIVERY_PENDING,…]`;
  terminals `COMPLETED/CANCELLED/REFUNDED`. `fulfillment_type` ∈
  {BUYER_TO_SELLER,COURIER,SELLER_TO_BUYER,DIGITAL}; `order_type` ∈
  {PHYSICAL,SERVICE,DIGITAL}. Transitions are guarded by `assertValidTransition`.
- **Legacy contract:** created the order in a pre-PAID state; the webhook drives
  `→PAID`; fulfillment/type derived at creation.
- **Match:** ⚠️ The enum/guard exist and are authoritative; the **legacy initial
  status/type derivation must be re-verified against this exact map** (legacy may
  predate some values).
- **Migration:** the port must create the order in a status that legally reaches
  `PAID` via the current guard, and set `fulfillment_type`/`order_type` per product
  type + delivery choice.
- **Regression risk:** **High** if the derived initial status/type disagrees with
  the guard or with what the lifecycle actions (area 7) expect.

## 7. Buyer/seller order-lifecycle actions

- **Current contract (all present):** buyer `POST /buyers/orders/:id/collected`
  (`markOrderAsCollected`), `confirmReceipt`, `cancelOrder`; seller
  `POST /seller/orders/:id/confirm-booking` (`confirmBooking`), `sellerCancelOrder`;
  workflows `OrderCancellationWorkflow.cancelOrder`,
  `OrderFulfillmentService.confirmBooking`. They read `product_orders` and apply
  guarded transitions.
- **Legacy contract:** initiation produced orders these actions later consume
  (via `status`, `fulfillment_type`, `pre_handoff_sla`, `metadata`).
- **Match:** ⚠️ Consumers exist; correctness depends entirely on the port
  producing the fields/statuses they branch on.
- **Migration:** none to the actions themselves; the port must populate the
  order fields they read (esp. `fulfillment_type`, `pre_handoff_sla`,
  custom/imported metadata, deadlines).
- **Regression risk:** **Medium–High**, verified only by full-lifecycle tests.

## 8. Logistics door-delivery creation + completion

- **Current contract (present):** `logisticsRequest.createDoorDeliveryPaymentPending
  (client, {order, payment, quote, buyer, product, seller, idempotencyKey})`
  creates legs in `payment_pending`; a fee-paid gate
  (`logisticsDashboard.helpers`) blocks status updates until the logistics fee is
  paid; delivery legs progress after payment.
- **Legacy contract:** same call + wrote `logistics` summary into payment &
  order metadata (`{delivery,logistics}`).
- **Match:** ✅ signature matches; ⚠️ metadata-shape coupling must be preserved.
- **Migration:** reuse the service; replicate the metadata writes (`payments.metadata`
  and `product_orders.metadata.delivery.logistics`).
- **Regression risk:** **Medium** for the door-delivery path (skip for pickup/digital).

## 9. Creator attribution → earnings → escrow

- **Current contract (present):** `CreatorService.resolveAttribution({code,
  sellerId,productSubtotal})` returns attribution incl. `commission_amount`;
  `INSERT INTO creator_earnings` / `creator_referral_earnings` /
  `referral_earnings_log` record earnings (triggered on completion/escrow release).
- **Legacy contract:** initiation called `resolveAttribution` and stored
  `creator_attribution` in order+payment `metadata.pricing`; earnings recorded
  later from that metadata.
- **Match:** ⚠️ resolver signature matches; earnings recording depends on the
  **metadata key names** the port writes (`creator_attribution`,
  `creator_commission_amount`, `seller_payout_base`).
- **Migration:** preserve the exact pricing/attribution metadata keys the legacy
  wrote; verify the current earnings-recording path reads the same keys.
- **Regression risk:** **Medium** (creator-code purchases only), verified by a
  creator-attributed lifecycle test through to earnings.

## 10. Frontend `useProductCheckout` response contract

- **Current contract:** posts to `/payments/initiate-product`; on success expects
  `data.{orderNumber, orderId, paymentId, reference}`, shows "STK push sent",
  opens the payment modal keyed on `orderNumber`, then polls
  `/payments/status/:invoiceId`.
- **Legacy contract:** returned `{ success, orderId, orderNumber, paymentId,
  paymentResult:{reference,status} }`.
- **Match:** ✅ shape matches (`orderNumber` present → modal opens; `reference`
  for polling).
- **Incompatibilities:** none expected; confirm the poll reads `paymentResult`/
  status correctly.
- **Regression risk:** **Low** — no frontend change needed.

---

## Summary of required work (from the contracts)

| Piece | Status | Action |
|---|---|---|
| `payments` insert | ✅ | reuse legacy insert |
| `PaystackProviderClient.initiatePayment` | ✅ | reuse |
| `completeVerifiedPayment` (webhook) | ✅ | reuse (proven) |
| Frontend contract | ✅ | none |
| `resolveAttribution`, logistics, lifecycle actions | ⚠️ | reuse; feed correct fields/metadata |
| Order-field derivation (`OrderService.createOrder`) | ❌ | **port** (fees, type, status) |
| Provider-attempt lifecycle | ❌ | **port** |
| Pricing/validation helpers | ❌ | **port** |
| Order status/type vs current guard | ⚠️ | **re-derive & verify** against enum/guard |

---

## Buyer purchase lifecycle test matrix

"Fixed" = selection → payment → order lifecycle → fulfillment → completion →
payout → creator attribution (where applicable). All against the **test env** +
**Paystack test keys**; payment completion driven by a signed `charge.success`
webhook (real M-Pesa STK can't auto-complete in test mode). No production money.

### A. Initiation validation (unit + integration, provider mocked)
| # | Scenario | Expected |
|---|---|---|
| 1 | Physical, pickup | order(PHYSICAL, pickup fulfillment) + payment(pending) + attempt row; total = subtotal + 2% |
| 2 | Physical, door delivery | + logistics `payment_pending` legs; total = subtotal + delivery + 2% |
| 3 | Digital | order(DIGITAL), no delivery; digital fulfillment |
| 4 | Service | order(SERVICE); service fulfillment |
| 5 | Custom product | requires prod_days 1–5 + instructions; `pre_handoff_sla.custom_production` |
| 6 | Imported product | import_days ∈ {7,14,21,30}; `pre_handoff_sla.import_waiting`; not custom+imported |
| 7 | Authenticated buyer | buyer_id set from session |
| 8 | Guest buyer | guest identity; order created; no auth |
| 9 | Quantity > 1 | subtotal = price×qty |
| 10 | Invalid quantity (0/neg) | rejected, no rows |
| 11 | Unavailable product | "Product not available"; no rows |
| 12 | Inactive seller | "Seller is not accepting orders"; no rows |
| 13 | Invalid delivery location | door delivery rejected; no partial rows |
| 14 | Idempotency replay (same token) | returns same order/payment; no duplicate |

### B. Payment + settlement (integration/E2E)
| # | Scenario | Expected |
|---|---|---|
| 15 | Paystack success (signed webhook) | payment→paid; order PAYMENT_PENDING→PAID; events dispatched |
| 16 | Paystack explicit failure | payment→failed; order→FAILED; reservations released |
| 17 | Ambiguous provider response | payment stays pending; attempt=ambiguous; settle later |
| 18 | Webhook replay (same event) | deduped ("already processed"); no double settle |
| 19 | Webhook, unknown reference | ignored/no-op; no state change |

### C. Post-payment lifecycle
| # | Scenario | Expected |
|---|---|---|
| 20 | Paid → completion path | PAID → (fulfillment/delivery) → COMPLETED per guard |
| 21 | Buyer receipt confirmation | `collected`/`confirmReceipt` → guarded transition |
| 22 | Buyer cancellation | `cancelOrder` where allowed → CANCELLED/REFUND_PENDING |
| 23 | Seller cancellation | `sellerCancelOrder` → guarded transition + compensation |
| 24 | Seller booking confirmation | `confirm-booking` → FULFILLING/READY per guard |
| 25 | Seller-side visibility | order appears in seller order lists with correct fields |
| 26 | Logistics/tracking (door delivery) | leg pays → DELIVERY_PENDING → DELIVERED → COMPLETED |
| 27 | Creator attribution → earnings | creator-coded purchase records `creator_earnings` on completion; `seller_payout_base` excludes delivery+service charge |
| 28 | Payout base correctness | seller payout = subtotal (excludes delivery & 2% service charge) |

---

## Revised implementation plan (for approval — no code until approved)

**Phase 0 — Enable faithful testing (prereq).** Replace `server/test/schema.sql`
with a schema-only dump of the Render DB (full 58 tables incl. fintech/logistics),
so integration tests can exercise `payment_provider_attempts`, logistics, creator
tables. (I can generate it from the DB URL already shared.)

**Phase 1 — Pure helpers (TDD, no DB).** Port pricing/validation helpers
(`roundMoney`, `roundPayableTotal`, `calculateProductServiceCharge` reuse,
custom/imported guards, door-delivery gating, idempotency-key extraction) with
unit tests. Reference numbers taken from the recovered legacy.

**Phase 2 — Order-field derivation (TDD).** Port the `OrderService.createOrder`
derivation (fees split, `fulfillment_type`, `order_type`, initial `status`,
order-number, `client_checkout_token`, reservation) as a focused unit that maps
nested input → `order.model.create`. Unit-test the derivation table; assert every
initial status is legal under the current `OrderStatusGuard`.

**Phase 3 — Provider-attempt lifecycle (TDD).** Port
`paymentProviderAttempt.service.js` (create/mark started/accepted/failed/ambiguous
+ ambiguity/failure settlement). Integration tests against the test DB.

**Phase 4 — Initiation orchestration (TDD, provider mocked).** Assemble
`ProductCheckoutService.initiateProductPayment(normalizedOrder)`: validate →
price → idempotency → tx(create order+payment+attempt) → COMMIT → charge → settle
attempt. Wire `paymentService.initiateProductPayment` to it (remove the `throw`).
Run matrix A (1–14) + B (15–19) with the provider mocked and the webhook simulated.

**Phase 5 — Downstream lifecycle verification.** Run matrix C (20–28) against the
test DB to confirm the port's outputs drive fulfillment, cancellation, booking,
logistics, payout base, and creator earnings correctly. Adapt field/metadata
mapping where a mismatch surfaces (do not alter the downstream services).

**Phase 6 — Security + code review.** `security-reviewer` (money + external
provider + guest input) and `code-reviewer`. Fix CRITICAL/HIGH.

**Phase 7 — E2E on Render (test keys).** Deploy branch to Render (test keys +
allowlisted IP still in place), drive the guest purchase, deliver signed
`charge.success`, verify via DB read-back that the order settles and progresses.
Then restore live keys / remove temp IP / rotate the DB password.

**Branch:** `fix/restore-product-checkout` off `main`.

### Open items needing your input
1. Approve **Phase 0** (pull a Render schema-only dump to replace `schema.sql`).
2. Confirm the branch name / that this lands separately from the test-env branch.
3. Confirm test buyer identity for guest vs authenticated matrix rows (any
   existing test buyer account, or synthesize one).
