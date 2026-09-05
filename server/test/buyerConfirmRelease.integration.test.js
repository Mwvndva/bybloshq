// Confirms that the buyer "confirm receipt / mark collected" action releases
// escrow and completes fulfilment for a Mzigo Ego (hub-routed physical) order.
//
// This drives the REAL buyer-confirm path the controller uses
// (CoreOrderService.markAsCollected -> OrderService._buyerComplete), which does
// the actual UPDATE product_orders SET status = 'COMPLETED' and then calls
// escrowManager.releaseFunds. That UPDATE->COMPLETED transition is exactly the
// path the legacy handle_order_completion_trigger used to intercept and block
// (dropped in 20260905140000), so this also regression-guards that fix against
// a real completion, not an order inserted directly as COMPLETED.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const CoreOrderService = (await import('../src/shared/core/CoreOrderService.js')).default;
const {
  createBuyer, createSeller, createCreator, createSellerCreatorLink,
  createCompletedOrder, createPayment,
  cleanupOrder, cleanupCreator, cleanupSeller, cleanupBuyer
} = await import('./helpers/factories.js');

const TOTAL = 1000;
const SELLER_PAYOUT = 940;
const PLATFORM_FEE = 10;
const COMMISSION = 50;

async function getMzigoPartnerId() {
  const { rows } = await pool.query(`SELECT id FROM logistics_partners WHERE slug = 'mzigo-ego' LIMIT 1`);
  return rows[0].id;
}

/**
 * Seeds a paid physical order that has been delivered via Mzigo Ego and is
 * sitting in READY_FOR_BUYER, waiting for the buyer to confirm. Optionally wires
 * a creator (commission) and lets the caller make the logistics unhealthy.
 */
async function seedMzigoOrder({ withCreator = false, legStatus = 'delivered', requestStatus = 'completed' } = {}) {
  const partnerId = await getMzigoPartnerId();
  const buyer = await createBuyer({});
  const seller = await createSeller({});

  let creator = null, link = null, metadata = {};
  if (withCreator) {
    creator = await createCreator({});
    link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });
    metadata = { creator_attribution: { creator_id: creator.id, seller_creator_link_id: link.id, seller_id: seller.id, commission_rate: 0.05, commission_base_amount: TOTAL, commission_amount: COMMISSION } };
  }

  const order = await createCompletedOrder({
    buyerId: buyer.id, sellerId: seller.id, totalAmount: TOTAL, sellerPayoutAmount: SELLER_PAYOUT, platformFeeAmount: PLATFORM_FEE, metadata
  });
  // Reset from the factory's COMPLETED default to the real pre-confirmation
  // state: a delivered physical order awaiting the buyer's confirmation.
  await pool.query(
    `UPDATE product_orders SET status = 'READY_FOR_BUYER', completed_at = NULL, order_type = 'PHYSICAL', fulfillment_type = 'COURIER' WHERE id = $1`,
    [order.id]
  );
  const payment = await createPayment({ orderId: order.id, amount: TOTAL });

  const { rows: [req] } = await pool.query(
    `INSERT INTO logistics_requests (order_id, partner_id, package_code, status) VALUES ($1,$2,$3,$4) RETURNING id`,
    [order.id, partnerId, `BYB-LOG-${order.id}`, requestStatus]
  );
  await pool.query(
    `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, destination_label) VALUES ($1,'delivery','buyer',$2,'Buyer home')`,
    [req.id, legStatus]
  );

  return { buyer, seller, creator, order, payment, requestId: req.id };
}

async function cleanup({ order, seller, buyer, creator, requestId }) {
  if (requestId) {
    await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]).catch(() => {});
  }
  if (order) await cleanupOrder(order.id).catch(() => {});
  if (creator) await cleanupCreator(creator.id).catch(() => {});
  if (seller) await cleanupSeller(seller.id).catch(() => {});
  if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
}

const sellerPending = async (id) => Number((await pool.query('SELECT COALESCE(pending_settlement_balance,0)::float AS v FROM sellers WHERE id = $1', [id])).rows[0].v);

describe('Buyer confirm -> escrow release + completion (Mzigo Ego delivered order)', () => {
  test('confirming a delivered order completes it and releases funds to the seller', async (t) => {
    let f; t.after(() => cleanup(f || {}));
    f = await seedMzigoOrder();
    const before = await sellerPending(f.seller.id);

    const result = await CoreOrderService.markAsCollected(f.order.id, f.buyer.id);

    // Fulfilment completed.
    assert.equal(result.status, 'COMPLETED');
    const { rows: [o] } = await pool.query('SELECT status, completed_at FROM product_orders WHERE id = $1', [f.order.id]);
    assert.equal(o.status, 'COMPLETED');
    assert.ok(o.completed_at, 'completed_at is stamped');

    // Funds released to the seller's pending-settlement wallet + a payout row.
    assert.equal(await sellerPending(f.seller.id), before + SELLER_PAYOUT, 'seller credited the full payout');
    const { rows: [p] } = await pool.query("SELECT settlement_status FROM payouts WHERE order_id = $1", [f.order.id]);
    assert.ok(p, 'a payout row was created');
    assert.equal(p.settlement_status, 'pending_settlement');
  });

  test('creator commission is released too when the order is creator-attributed', async (t) => {
    let f; t.after(() => cleanup(f || {}));
    f = await seedMzigoOrder({ withCreator: true });

    await CoreOrderService.markAsCollected(f.order.id, f.buyer.id);

    const { rows: [ce] } = await pool.query('SELECT amount::float AS amount FROM creator_earnings WHERE order_id = $1', [f.order.id]);
    assert.ok(ce, 'a creator_earnings row was created on release');
    assert.equal(ce.amount, COMMISSION);
    const { rows: [c] } = await pool.query('SELECT balance::float AS balance FROM creators WHERE id = $1', [f.creator.id]);
    assert.equal(c.balance, COMMISSION, 'creator balance credited the commission');
  });

  test('confirming twice does not double-release (ON CONFLICT idempotency gate)', async (t) => {
    let f; t.after(() => cleanup(f || {}));
    f = await seedMzigoOrder();
    const before = await sellerPending(f.seller.id);

    await CoreOrderService.markAsCollected(f.order.id, f.buyer.id);
    // A second confirmation (e.g. double-tap / retry) must be a no-op for money.
    await CoreOrderService.markAsCollected(f.order.id, f.buyer.id);

    assert.equal(await sellerPending(f.seller.id), before + SELLER_PAYOUT, 'credited exactly once');
    const { rows: [{ n }] } = await pool.query("SELECT count(*)::int AS n FROM payouts WHERE order_id = $1", [f.order.id]);
    assert.equal(n, 1, 'exactly one payout row');
  });

  test('a failed delivery leg holds the release even though the order completes', async (t) => {
    let f; t.after(() => cleanup(f || {}));
    f = await seedMzigoOrder({ legStatus: 'failed' });
    const before = await sellerPending(f.seller.id);

    await CoreOrderService.markAsCollected(f.order.id, f.buyer.id);

    // The logistics hold in EscrowManager.releaseFunds blocks the payout.
    assert.equal(await sellerPending(f.seller.id), before, 'seller NOT credited while logistics is in a failed state');
    const { rows: [{ n }] } = await pool.query("SELECT count(*)::int AS n FROM payouts WHERE order_id = $1", [f.order.id]);
    assert.equal(n, 0, 'no payout row created under a logistics hold');
  });
});
