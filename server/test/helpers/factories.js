/**
 * factories.js
 *
 * Minimal, schema-accurate row factories for integration tests. Every field
 * set here was verified against the real test database schema (server/test/
 * schema.sql) before being written — not guessed from application code
 * assumptions. Each factory returns the inserted row; callers are
 * responsible for tracking ids to clean up in an `after` hook (see
 * cleanupOrder/cleanupCreator helpers below), since these tests run against
 * a real, shared database rather than a per-test transaction (the app code
 * under test opens its own pool connections/transactions internally, so an
 * outer wrapping transaction on a different connection would not contain
 * them).
 */
import { pool } from '../../src/infrastructure/database/database.js';

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

export async function createUser({ email, role = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_verified)
     VALUES ($1, 'test-hash-not-a-real-password', $2, TRUE)
     RETURNING *`,
    [email || `${unique('user')}@test.byblos.local`, role]
  );
  return rows[0];
}

export async function createBuyer({ userId = null, email, mobilePayment, fullName = 'Test Buyer' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO buyers (user_id, full_name, email, mobile_payment)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, fullName, email || `${unique('buyer')}@test.byblos.local`, mobilePayment || `2547${String(unique('')).slice(-8)}`]
  );
  return rows[0];
}

export async function createSeller({ userId = null, shopName, email, creatorCommissionRate = 0.01 } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO sellers (user_id, full_name, shop_name, email, creator_commission_rate)
     VALUES ($1, 'Test Seller', $2, $3, $4)
     RETURNING *`,
    [userId, shopName || unique('Test Shop '), email || `${unique('seller')}@test.byblos.local`, creatorCommissionRate]
  );
  return rows[0];
}

export async function createCreator({ userId = null, email, mpesaNumber, firstName = 'Test', lastName = 'Creator' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO creators (user_id, first_name, last_name, email, mpesa_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, firstName, lastName, email || `${unique('creator')}@test.byblos.local`, mpesaNumber || `2547${String(unique('')).slice(-8)}`]
  );
  return rows[0];
}

export async function createSellerCreatorLink({ sellerId, creatorId, commissionRate = 0.05 }) {
  const { rows } = await pool.query(
    `INSERT INTO seller_creator_links (seller_id, creator_id, code, commission_rate, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING *`,
    [sellerId, creatorId, unique('CODE').toUpperCase().slice(0, 32), commissionRate]
  );
  return rows[0];
}

/**
 * Creates a product_orders row already in COMPLETED status with consistent
 * financials, matching what EscrowManager.releaseFunds expects to find.
 *
 * Pass `status`/`paymentStatus`/`orderType`/`fulfillmentType` to instead get
 * a row at an earlier lifecycle point (e.g. PAID + PHYSICAL/COURIER) for
 * fulfillment-flow tests that need to drive the order through
 * OrderFulfillmentTransitionService / OrderHubDropoffService / logistics
 * themselves rather than starting from an already-completed order.
 */
export async function createCompletedOrder({
  buyerId,
  sellerId,
  totalAmount,
  sellerPayoutAmount,
  platformFeeAmount = 10,
  totalQuantity = 1,
  metadata = {},
  status = 'COMPLETED',
  paymentStatus = 'completed',
  orderType = null,
  fulfillmentType = null
}) {
  const orderNumber = unique('ORD-');
  const completedAtExpr = status === 'COMPLETED' ? 'NOW()' : 'NULL';
  const { rows } = await pool.query(
    `INSERT INTO product_orders (
       order_number, buyer_id, seller_id, total_amount, platform_fee_amount,
       seller_payout_amount, status, payment_status, total_quantity,
       client_checkout_token, metadata, completed_at,
       order_type, fulfillment_type
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7::order_status, $8::payment_status, $9,
       $10, $11::jsonb, ${completedAtExpr},
       COALESCE($12::order_type, 'PHYSICAL'::order_type),
       COALESCE($13::fulfillment_type, 'BUYER_TO_SELLER'::fulfillment_type)
     )
     RETURNING *`,
    [
      orderNumber, buyerId, sellerId, totalAmount, platformFeeAmount, sellerPayoutAmount,
      status, paymentStatus, totalQuantity, unique('tok-'), JSON.stringify(metadata),
      orderType, fulfillmentType
    ]
  );
  return rows[0];
}

/** Creates an order_items row linked to a real products row (FK-required by fulfillment queries that JOIN products). */
export async function createOrderItem({ orderId, productId, name = 'Test Item', price = 100, quantity = 1 }) {
  const subtotal = Number(price) * Number(quantity);
  const { rows } = await pool.query(
    `INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal, product_name, product_price)
     VALUES ($1, $2, $3, $4, $5, $6, $3, $4)
     RETURNING *`,
    [orderId, productId, name, price, quantity, subtotal]
  );
  return rows[0];
}

/** Minimal product row. Defaults to track_inventory=false so fulfillment's inventory-commit step no-ops cleanly. */
export async function createProduct({
  sellerId,
  name = 'Test Product',
  price = 100,
  productType = 'physical',
  isDigital = false,
  digitalFilePath = null,
  digitalFileName = null,
  trackInventory = false,
  quantity = 0
}) {
  const { rows } = await pool.query(
    `INSERT INTO products (
       seller_id, name, price, product_type, is_digital,
       digital_file_path, digital_file_name, track_inventory, quantity
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [sellerId, name, price, productType, isDigital, digitalFilePath, digitalFileName, trackInventory, quantity]
  );
  return rows[0];
}

/** Deletes a product (order_items.product_id is ON DELETE SET NULL, so this is safe after cleanupOrder). */
export async function cleanupProduct(productId) {
  if (!productId) return;
  await pool.query('DELETE FROM products WHERE id = $1', [productId]);
}

export async function createPayment({ orderId, amount, status = 'completed' }) {
  const { rows } = await pool.query(
    `INSERT INTO payments (invoice_id, amount, status, order_id, metadata)
     VALUES ($1, $2, $3::payment_status, $4, $5::jsonb)
     RETURNING *`,
    [unique('INV-'), amount, status, orderId, JSON.stringify({ order_id: orderId })]
  );
  return rows[0];
}

export async function createRefundRequest({ buyerId, orderId, amount, status = 'pending' }) {
  const { rows } = await pool.query(
    `INSERT INTO refund_requests (buyer_id, order_id, amount, status, payment_method)
     VALUES ($1, $2, $3, $4, 'mpesa')
     RETURNING *`,
    [buyerId, orderId, amount, status]
  );
  return rows[0];
}

/**
 * Deletes everything created for one order, in FK-safe (children-first)
 * order — EXCEPT when the order has a logistics_requests row.
 * logistics_tracking_events are made immutable by a real DB trigger
 * (prevent_logistics_tracking_event_mutation — a deliberate audit-trail
 * guarantee, not a bug): it blocks UPDATE and DELETE outright, which
 * transitively makes logistics_legs and logistics_requests undeletable too
 * (they're referenced by the immutable events), and that in turn RESTRICTs
 * deleting product_orders itself (logistics_requests.order_id -> product_orders
 * ON DELETE RESTRICT). So any test order that goes through a real logistics
 * flow (seller hub dropoff, Mzigo pickup, door delivery) is a permanent
 * fixture in the test DB, exactly as it would be in production — order_items/
 * payments/product_orders are deliberately left in place rather than made to
 * fail; only the deletable side-tables are cleaned up.
 */
export async function cleanupOrder(orderId) {
  const { rows: logisticsRows } = await pool.query(
    'SELECT 1 FROM logistics_requests WHERE order_id = $1 LIMIT 1',
    [orderId]
  );
  const hasImmutableLogisticsHistory = logisticsRows.length > 0;

  await pool.query('DELETE FROM fraud_events WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM refund_requests WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM payouts WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM creator_referral_earnings WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM creator_earnings WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM digital_access WHERE order_id = $1', [orderId]);

  if (hasImmutableLogisticsHistory) {
    return;
  }

  await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
  await pool.query('DELETE FROM product_orders WHERE id = $1', [orderId]);
}

/** Deletes a creator + any links/requests tied to it (order-level rows must already be gone). */
export async function cleanupCreator(creatorId) {
  await pool.query('DELETE FROM seller_creator_links WHERE creator_id = $1', [creatorId]);
  await pool.query('DELETE FROM creators WHERE id = $1', [creatorId]);
}

export async function cleanupSeller(sellerId) {
  await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]);
}

export async function cleanupBuyer(buyerId) {
  await pool.query('DELETE FROM buyers WHERE id = $1', [buyerId]);
}

export async function cleanupUser(userId) {
  if (!userId) return;
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}
