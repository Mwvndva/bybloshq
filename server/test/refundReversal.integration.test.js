// Integration test for audit P1-1: the admin refund-approval endpoint used
// to reverse the seller's escrow settlement but never claw back the
// creator's commission on the same order. This drives the REAL controller
// function (refund.controller.js#confirmRefundRequest) against a real
// database end to end: escrow release credits the creator, then a refund is
// approved, and the creator's earning/balance must come back down.
//
// See escrowRelease.integration.test.js for why cleanup is one t.after()
// hook registered up front with explicit ordering, rather than trailing
// cleanup code or several individually-registered hooks.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import { confirmRefundRequest } from '../src/domains/payments/refunds/refund.controller.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  createSellerCreatorLink,
  createCompletedOrder,
  createPayment,
  createRefundRequest,
  cleanupOrder,
  cleanupCreator,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} from './helpers/factories.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('confirmRefundRequest (integration, audit P1-1)', () => {
  test('reverses the creator commission alongside the seller settlement when a refund is approved', async (t) => {
    let admin, buyer, seller, creator, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
    });

    admin = await createUser({});
    buyer = await createBuyer({});
    seller = await createSeller({});
    creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 940,
      platformFeeAmount: 10,
      metadata: {
        creator_attribution: {
          creator_id: creator.id,
          seller_creator_link_id: link.id,
          seller_id: seller.id,
          commission_rate: 0.05,
          commission_base_amount: 1000,
          commission_amount: 50
        }
      }
    });
    await createPayment({ orderId: order.id, amount: 1000 });

    // 1. Escrow release: creator gets credited 50, seller pending-settlement gets 940.
    const escrowClient = await pool.connect();
    try {
      await escrowClient.query('BEGIN');
      await EscrowManager.releaseFunds(escrowClient, order, 'integration-test');
      await escrowClient.query('COMMIT');
    } finally {
      escrowClient.release();
    }

    const { rows: beforeCreator } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(beforeCreator[0].balance), 50, 'sanity check: creator was credited before the refund');

    // 2. Buyer requests a refund; admin approves it via the real controller function.
    const refundRequest = await createRefundRequest({ buyerId: buyer.id, orderId: order.id, amount: 1000 });

    const req = { params: { id: refundRequest.id }, body: { adminNotes: 'integration test approval' }, user: { id: admin.id } };
    const res = fakeRes();
    let nextError = null;
    await confirmRefundRequest(req, res, (err) => { nextError = err; });

    assert.equal(nextError, null, `confirmRefundRequest called next(err): ${nextError?.message}`);
    assert.equal(res.statusCode, 200);

    // 3. THE REGRESSION ASSERTION: the creator's commission must be clawed
    // back, not left in place while only the seller's settlement reverses.
    const { rows: afterCreator } = await pool.query('SELECT balance, total_earnings FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(afterCreator[0].balance), 0, 'creator balance must be reversed back to 0');
    assert.equal(Number(afterCreator[0].total_earnings), 0, 'creator total_earnings must be reversed back to 0');

    const { rows: earningRows } = await pool.query('SELECT status FROM creator_earnings WHERE order_id = $1', [order.id]);
    assert.equal(earningRows[0].status, 'reversed');

    // Seller settlement reversal (already correct before this fix) must
    // still work too — verifying the fix didn't regress the existing path.
    const { rows: payoutRows } = await pool.query('SELECT status, settlement_status FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows[0].status, 'refunded');

    const { rows: buyerRows } = await pool.query('SELECT refunds FROM buyers WHERE id = $1', [buyer.id]);
    assert.equal(Number(buyerRows[0].refunds), 1000);

    const { rows: orderRows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(orderRows[0].status, 'REFUNDED');
  });
});
