// Integration tests for audit P1-3 (self-referral at checkout) and the
// follow-on T+2 review-hold feature (post-hoc detection at credit time +
// admin resolution), against a real database.
//
// See escrowRelease.integration.test.js for why cleanup is one t.after()
// hook registered up front with explicit ordering, rather than trailing
// cleanup code or several individually-registered hooks (Node's test
// runner runs t.after() hooks in registration order, not reverse — several
// separately-registered hooks do not self-order by FK dependency, which is
// exactly what broke this file's cleanup the first time it was written).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import {
  createUser,
  createBuyer,
  createSeller,
  createCreator,
  createSellerCreatorLink,
  createCompletedOrder,
  cleanupOrder,
  cleanupCreator,
  cleanupSeller,
  cleanupBuyer,
  cleanupUser
} from './helpers/factories.js';

describe('CreatorService.resolveAttribution (integration, audit P1-3)', () => {
  test('blocks attribution when the checking-out identity is the SAME authenticated user as the creator', async (t) => {
    let user, seller, creator;
    t.after(async () => {
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    seller = await createSeller({});
    creator = await createCreator({ userId: user.id });
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    const attribution = await CreatorService.resolveAttribution({
      code: link.code,
      sellerId: seller.id,
      productSubtotal: 1000,
      buyer: {
        userId: user.id, // same authenticated identity as the creator
        email: 'a-completely-different-guest-email@test.byblos.local',
        mobilePayment: '254799999999'
      }
    });

    assert.equal(attribution, null);
  });

  test('still attributes commission to a legitimate third-party buyer with no overlapping identity', async (t) => {
    let seller, creator;
    t.after(async () => {
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
    });

    seller = await createSeller({});
    creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    const attribution = await CreatorService.resolveAttribution({
      code: link.code,
      sellerId: seller.id,
      productSubtotal: 1000,
      buyer: {
        email: 'real-customer@test.byblos.local',
        mobilePayment: '254700111222'
      }
    });

    assert.ok(attribution, 'a legitimate buyer must still get attributed');
    assert.equal(attribution.creator_id, creator.id);
    assert.equal(attribution.commission_amount, 50);
  });
});

describe('CreatorService post-hoc self-dealing review hold (integration)', () => {
  test('flags the earning for review when the order buyer resolves to the creator\'s own buyer profile at credit time', async (t) => {
    let user, creatorOwnBuyer, seller, creator, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (creatorOwnBuyer) await cleanupBuyer(creatorOwnBuyer.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    creatorOwnBuyer = await createBuyer({ userId: user.id }); // the creator's own buyer identity
    seller = await createSeller({});
    creator = await createCreator({ userId: user.id });
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });

    // As if checkout-time attribution succeeded (the point of this test is
    // creditCreatorForOrder's own independent re-check, not resolveAttribution).
    order = await createCompletedOrder({
      buyerId: creatorOwnBuyer.id,
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

    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      inserted = await CreatorService.creditCreatorForOrder(client, { order, paymentId: null });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    assert.ok(inserted, 'the earning is still created (invisible hold, not a block)');

    const { rows: earningRows } = await pool.query('SELECT metadata, status FROM creator_earnings WHERE order_id = $1', [order.id]);
    assert.equal(earningRows[0].metadata.flagged_for_review, true);
    assert.equal(earningRows[0].status, 'credited', 'status stays normal — only the metadata flag marks it held');

    // The money is still credited normally (buyer/creator see nothing different)...
    const { rows: creatorRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorRows[0].balance), 50);

    // ...but the review-hold makes it permanently uncleared, not just T+2.
    const clearance = await CreatorService.getCreatorClearance(creator.id);
    assert.equal(clearance.availableBalance, 0);
    assert.equal(clearance.hasFlaggedHolds, true);
    assert.equal(clearance.flaggedAmount, 50);

    // A fraud_events record exists for admin visibility.
    const { rows: fraudRows } = await pool.query(
      "SELECT event_type FROM fraud_events WHERE order_id = $1 AND event_type = 'creator_self_referral_suspected'",
      [order.id]
    );
    assert.equal(fraudRows.length, 1);
  });

  test('admin "release" clears the hold without touching the balance', async (t) => {
    let user, admin, creatorOwnBuyer, seller, creator, order;
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (creatorOwnBuyer) await cleanupBuyer(creatorOwnBuyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    admin = await createUser({});
    creatorOwnBuyer = await createBuyer({ userId: user.id });
    seller = await createSeller({});
    creator = await createCreator({ userId: user.id });
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });
    order = await createCompletedOrder({
      buyerId: creatorOwnBuyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 940,
      platformFeeAmount: 10,
      metadata: { creator_attribution: { creator_id: creator.id, seller_creator_link_id: link.id, seller_id: seller.id, commission_rate: 0.05, commission_base_amount: 1000, commission_amount: 50 } }
    });

    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      inserted = await CreatorService.creditCreatorForOrder(client, { order, paymentId: null });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const result = await CreatorService.resolveFlaggedEarning({
      earningType: 'sales',
      earningId: inserted.id,
      adminId: admin.id,
      action: 'release',
      notes: 'reviewed, legitimate'
    });
    assert.equal(result.action, 'release');

    const { rows: earningRows } = await pool.query('SELECT metadata FROM creator_earnings WHERE id = $1', [inserted.id]);
    assert.equal(earningRows[0].metadata.flagged_for_review, false);
    assert.equal(earningRows[0].metadata.review_resolution, 'released');

    const { rows: creatorRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorRows[0].balance), 50, 'release must not touch the balance');
  });

  test('admin "reverse" claws back only this earning, without touching an unrelated referral reward on the same order', async (t) => {
    let user, admin, creatorOwnBuyer, referrerCreator, seller, creator, order;
    // Explicit order matters here: the order (and its creator_earnings /
    // creator_referral_earnings rows) must go first; the seller (which holds
    // the FK to referrerCreator) must be removed before referrerCreator; the
    // rest can follow in any safe order.
    t.after(async () => {
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (referrerCreator) await cleanupCreator(referrerCreator.id).catch(() => {});
      if (creatorOwnBuyer) await cleanupBuyer(creatorOwnBuyer.id).catch(() => {});
      if (admin) await cleanupUser(admin.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    admin = await createUser({});
    creatorOwnBuyer = await createBuyer({ userId: user.id });
    // A second, unrelated creator referred this seller to Byblos — this
    // earning must survive the reversal below untouched.
    referrerCreator = await createCreator({});
    seller = await createSeller({});
    creator = await createCreator({ userId: user.id });
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id, commissionRate: 0.05 });
    await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [referrerCreator.id, seller.id]);

    order = await createCompletedOrder({
      buyerId: creatorOwnBuyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 940,
      platformFeeAmount: 10,
      totalQuantity: 5, // 5 units -> referral reward also exercises the P2-1 cap (capped at 10, not 15)
      metadata: { creator_attribution: { creator_id: creator.id, seller_creator_link_id: link.id, seller_id: seller.id, commission_rate: 0.05, commission_base_amount: 1000, commission_amount: 50 } }
    });

    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      inserted = await CreatorService.creditCreatorForOrder(client, { order, paymentId: null });
      await CreatorService.creditCreatorReferralForSeller(client, { order });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const { rows: referralBefore } = await pool.query('SELECT amount FROM creator_referral_earnings WHERE order_id = $1', [order.id]);
    assert.equal(referralBefore.length, 1, 'sanity check: the unrelated referral reward was created');
    assert.equal(Number(referralBefore[0].amount), 10, 'sanity check: capped at the platform fee, same as the dedicated P2-1 test');

    const result = await CreatorService.resolveFlaggedEarning({
      earningType: 'sales',
      earningId: inserted.id,
      adminId: admin.id,
      action: 'reverse',
      notes: 'confirmed self-dealing'
    });
    assert.equal(result.reversalResult.adjusted, true);

    const { rows: earningRows } = await pool.query('SELECT status FROM creator_earnings WHERE id = $1', [inserted.id]);
    assert.equal(earningRows[0].status, 'reversed');

    const { rows: creatorRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorRows[0].balance), 0, 'the self-dealing earning must be clawed back');

    // THE ISOLATION ASSERTION: the unrelated referral reward on the same
    // order must still be intact — this is exactly what _reverseSingleEarning
    // exists to guarantee instead of reusing the whole-order reversal helper.
    const { rows: referralAfter } = await pool.query('SELECT status, amount FROM creator_referral_earnings WHERE order_id = $1', [order.id]);
    assert.equal(referralAfter[0].status, 'credited');
    assert.equal(Number(referralAfter[0].amount), 10);
    const { rows: referrerRows } = await pool.query('SELECT total_referral_earnings FROM creators WHERE id = $1', [referrerCreator.id]);
    assert.equal(Number(referrerRows[0].total_referral_earnings), 10);
  });
});
