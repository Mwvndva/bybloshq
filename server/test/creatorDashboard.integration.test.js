// End-to-end integration tests for the creator-dashboard redesign backend:
// profile M-Pesa validation, promotion/invite caps, both leave flows, and the
// commission-vs-referral earnings split. Runs against the real test database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import CreatorService from '../src/domains/growth/creators/creator.service.js';
import ReferralService from '../src/domains/growth/referrals/referral.service.js';
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

let refSeq = 0;
const uniqueRefCode = () => `CRT${Date.now().toString(36).toUpperCase()}${(refSeq++).toString(36).toUpperCase()}`.slice(0, 24);

async function cleanupCreatorFinancials(creatorId) {
  if (!creatorId) return;
  await pool.query('UPDATE sellers SET referred_by_creator_id = NULL WHERE referred_by_creator_id = $1', [creatorId]).catch(() => {});
  await pool.query('DELETE FROM creator_earnings WHERE creator_id = $1', [creatorId]).catch(() => {});
  await pool.query('DELETE FROM creator_referral_earnings WHERE referrer_creator_id = $1', [creatorId]).catch(() => {});
  await pool.query('DELETE FROM creator_shop_requests WHERE creator_id = $1', [creatorId]).catch(() => {});
  await pool.query('DELETE FROM seller_creator_links WHERE creator_id = $1', [creatorId]).catch(() => {});
}

describe('creator profile — M-Pesa number', () => {
  test('normalizes a valid number and rejects an invalid one', async (t) => {
    let creator;
    t.after(async () => { if (creator) await cleanupCreator(creator.id).catch(() => {}); });

    creator = await createCreator({});

    const updated = await CreatorService.updateProfile(creator.id, { mpesaNumber: '+254712345678' });
    assert.equal(updated.mpesa_number, '0712345678', 'normalizes +254 form to local 07 form');

    await assert.rejects(
      () => CreatorService.updateProfile(creator.id, { mpesaNumber: '123' }),
      /valid M-Pesa number/
    );
  });
});

describe('creator limits — promotions', () => {
  test('blocks requesting a 4th active promotion', async (t) => {
    let creator; const sellers = [];
    t.after(async () => {
      if (creator) await cleanupCreatorFinancials(creator.id);
      for (const s of sellers) await cleanupSeller(s.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
    });

    creator = await createCreator({});
    for (let i = 0; i < 3; i++) {
      const s = await createSeller({});
      sellers.push(s);
      await createSellerCreatorLink({ sellerId: s.id, creatorId: creator.id });
    }

    const fourth = await createSeller({});
    sellers.push(fourth);
    await pool.query('UPDATE sellers SET is_creator_marketplace_enabled = TRUE WHERE id = $1', [fourth.id]);

    await assert.rejects(
      () => CreatorService.requestCollaboration(creator.id, fourth.id),
      /at most 3 shops/
    );
  });
});

describe('creator limits — invites', () => {
  test('does not attribute a 4th invited business', async (t) => {
    let creator; const sellers = [];
    t.after(async () => {
      if (creator) await cleanupCreatorFinancials(creator.id);
      for (const s of sellers) await cleanupSeller(s.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
    });

    creator = await createCreator({});
    const code = uniqueRefCode();
    await pool.query(`UPDATE creators SET referral_code = $1, status = 'active' WHERE id = $2`, [code, creator.id]);

    for (let i = 0; i < 3; i++) {
      const s = await createSeller({});
      sellers.push(s);
      await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [creator.id, s.id]);
    }

    const fourth = await createSeller({});
    sellers.push(fourth);
    const result = await ReferralService.applyReferral(fourth.id, code);
    assert.equal(result, null, 'attribution is skipped at the cap');

    const { rows } = await pool.query('SELECT referred_by_creator_id FROM sellers WHERE id = $1', [fourth.id]);
    assert.equal(rows[0].referred_by_creator_id, null, '4th seller stays unattributed');
  });
});

describe('creator leave — promoted shop', () => {
  test('blocks while an order is open, then succeeds once terminal', async (t) => {
    let creator, seller, buyer, user, order;
    t.after(async () => {
      if (creator) await cleanupCreatorFinancials(creator.id);
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    buyer = await createBuyer({ userId: user.id });
    seller = await createSeller({});
    creator = await createCreator({});
    const link = await createSellerCreatorLink({ sellerId: seller.id, creatorId: creator.id });

    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 1000,
      sellerPayoutAmount: 900,
      status: 'PAID',
      paymentStatus: 'completed',
      metadata: { creator_attribution: { creator_id: creator.id, seller_creator_link_id: link.id } }
    });

    await assert.rejects(
      () => CreatorService.leavePromotedShop(creator.id, seller.id),
      /Complete 1 open order/
    );

    await pool.query(`UPDATE product_orders SET status = 'COMPLETED' WHERE id = $1`, [order.id]);

    const res = await CreatorService.leavePromotedShop(creator.id, seller.id);
    assert.equal(res.status, 'left');

    const { rows } = await pool.query('SELECT status FROM seller_creator_links WHERE id = $1', [link.id]);
    assert.equal(rows[0].status, 'left', 'link is terminated');
  });
});

describe('creator leave — invited business', () => {
  test('cancels pending referral earnings, reverses balance, and detaches', async (t) => {
    let creator, seller, buyer, user, order;
    t.after(async () => {
      if (creator) await cleanupCreatorFinancials(creator.id);
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    buyer = await createBuyer({ userId: user.id });
    seller = await createSeller({});
    creator = await createCreator({});

    await pool.query('UPDATE sellers SET referred_by_creator_id = $1 WHERE id = $2', [creator.id, seller.id]);
    await pool.query(`UPDATE creators SET balance = 3, total_referral_earnings = 3 WHERE id = $1`, [creator.id]);

    order = await createCompletedOrder({ buyerId: buyer.id, sellerId: seller.id, totalAmount: 500, sellerPayoutAmount: 450 });
    await pool.query(
      `INSERT INTO creator_referral_earnings (referrer_creator_id, referred_seller_id, order_id, amount, units_sold, status, created_at)
       VALUES ($1, $2, $3, 3, 1, 'credited', NOW())`,
      [creator.id, seller.id, order.id]
    );

    const res = await CreatorService.leaveInvitedBusiness(creator.id, seller.id);
    assert.equal(res.cancelledCount, 1);
    assert.equal(Number(res.cancelledPending), 3);

    const bal = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(bal.rows[0].balance), 0, 'pending amount reversed from balance');

    const earn = await pool.query(`SELECT status FROM creator_referral_earnings WHERE order_id = $1`, [order.id]);
    assert.equal(earn.rows[0].status, 'cancelled');

    const sel = await pool.query('SELECT referred_by_creator_id FROM sellers WHERE id = $1', [seller.id]);
    assert.equal(sel.rows[0].referred_by_creator_id, null, 'referral detached');
  });
});

describe('creator clearance — earnings split', () => {
  test('returns commission and invited-business earnings separately', async (t) => {
    let creator, seller, buyer, user, order1, order2;
    t.after(async () => {
      if (creator) await cleanupCreatorFinancials(creator.id);
      if (order1) await cleanupOrder(order1.id).catch(() => {});
      if (order2) await cleanupOrder(order2.id).catch(() => {});
      if (creator) await cleanupCreator(creator.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
      if (user) await cleanupUser(user.id).catch(() => {});
    });

    user = await createUser({});
    buyer = await createBuyer({ userId: user.id });
    seller = await createSeller({});
    creator = await createCreator({});
    await pool.query(`UPDATE creators SET balance = 103 WHERE id = $1`, [creator.id]);

    order1 = await createCompletedOrder({ buyerId: buyer.id, sellerId: seller.id, totalAmount: 2000, sellerPayoutAmount: 1800 });
    order2 = await createCompletedOrder({ buyerId: buyer.id, sellerId: seller.id, totalAmount: 500, sellerPayoutAmount: 450 });

    await pool.query(
      `INSERT INTO creator_earnings (creator_id, seller_id, order_id, amount, rate, base_amount, status)
       VALUES ($1, $2, $3, 100, 0.05, 2000, 'credited')`,
      [creator.id, seller.id, order1.id]
    );
    await pool.query(
      `INSERT INTO creator_referral_earnings (referrer_creator_id, referred_seller_id, order_id, amount, units_sold, status)
       VALUES ($1, $2, $3, 3, 1, 'credited')`,
      [creator.id, seller.id, order2.id]
    );

    const clearance = await CreatorService.getCreatorClearance(creator.id);
    assert.equal(Number(clearance.commissionEarnings), 100);
    assert.equal(Number(clearance.referralEarnings), 3);
  });
});
