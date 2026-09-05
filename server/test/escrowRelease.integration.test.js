// Integration tests for EscrowManager.releaseFunds against a real database.
// Covers the base credit path and the P2-1 referral-cap regression with
// actual rows and actual money movement, not just the pure-function math in
// creatorMoney.utils.test.js.
//
// Each test registers ONE t.after() hook up front (before creating
// anything), closing over variables assigned as resources are created. This
// runs regardless of whether the test passes or throws (unlike trailing
// cleanup code, which an earlier version of this suite proved will leak
// rows the moment an assertion fails first), and — unlike registering one
// t.after() per resource — Node's test runner runs t.after() hooks in
// REGISTRATION order, not reverse, so one hook with explicit, correct
// (children-before-parents) ordering is what actually works; several
// individually-registered hooks do not self-order by FK dependency.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import EscrowManager from '../src/domains/orders/escrow/EscrowManager.js';
import {
  createBuyer,
  createSeller,
  createCreator,
  createSellerCreatorLink,
  createCompletedOrder,
  createPayment,
  cleanupOrder,
  cleanupCreator,
  cleanupSeller,
  cleanupBuyer
} from './helpers/factories.js';

describe('EscrowManager.releaseFunds (integration)', () => {
  test('credits the creator commission and the seller payout for a normal order', async (t) => {
    let buyer, seller, creator, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    // subtotal 1000, commission 5% = 50, flat platform fee 10 -> seller payout 940
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
    const payment = await createPayment({ orderId: order.id, amount: 1000 });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await EscrowManager.releaseFunds(client, order, 'integration-test');
      await client.query('COMMIT');
      assert.equal(result.success, true);
    } finally {
      client.release();
    }

    const { rows: earningRows } = await pool.query('SELECT * FROM creator_earnings WHERE order_id = $1', [order.id]);
    assert.equal(earningRows.length, 1);
    assert.equal(Number(earningRows[0].amount), 50);
    assert.equal(earningRows[0].payment_id, payment.id);

    const { rows: creatorRows } = await pool.query('SELECT balance, total_earnings FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorRows[0].balance), 50);
    assert.equal(Number(creatorRows[0].total_earnings), 50);

    const { rows: payoutRows } = await pool.query('SELECT amount FROM payouts WHERE order_id = $1', [order.id]);
    assert.equal(payoutRows.length, 1);
    assert.equal(Number(payoutRows[0].amount), 940);

    const { rows: sellerRows } = await pool.query('SELECT pending_settlement_balance FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(Number(sellerRows[0].pending_settlement_balance), 940);
  });

  test('caps the creator-refers-seller reward at the platform flat fee on a 5-unit order (audit P2-1 regression, real DB)', async (t) => {
    let buyer, referrerCreator, seller, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (referrerCreator) await cleanupCreator(referrerCreator.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    referrerCreator = await createCreator({});
    seller = await createSeller({});
    await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [referrerCreator.id, seller.id]);

    // 5 units: naive reward would be 5 * 3 = 15 KES, which must be capped at
    // the 10 KES flat platform fee this reward is funded from.
    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 5000,
      sellerPayoutAmount: 4990,
      platformFeeAmount: 10,
      totalQuantity: 5
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await EscrowManager.releaseFunds(client, order, 'integration-test');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const { rows: referralRows } = await pool.query(
      'SELECT amount, units_sold FROM creator_referral_earnings WHERE order_id = $1',
      [order.id]
    );
    assert.equal(referralRows.length, 1);
    assert.equal(referralRows[0].units_sold, 5);
    // This is the actual regression assertion: NOT 15, capped at 10.
    assert.equal(Number(referralRows[0].amount), 10);

    const { rows: creatorRows } = await pool.query(
      'SELECT total_referral_earnings FROM creators WHERE id = $1',
      [referrerCreator.id]
    );
    assert.equal(Number(creatorRows[0].total_referral_earnings), 10);
  });
});
