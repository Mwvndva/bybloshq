// Real-path tests for the inventory-TTL cleanup cron fix.
//
// Regression target: the cancel UPDATE previously had no status guard and released
// inventory BEFORE cancelling, so a payment completing mid-run could get a paid
// order cancelled-and-failed (and inventory double-released under multi-instance).
// The fix guards the UPDATE on payment_status='pending' and releases inventory
// only when the cancellation actually happened.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/infrastructure/database/database.js';
import { releaseExpiredUnpaidReservations } from '../src/application/cron/cleanupCron.js';

const uniq = `cleanup-${Date.now()}`;

async function makeOrder({ paymentStatus, minutesOld, sellerId, buyerId }) {
  const token = `${uniq}-${Math.random().toString(36).slice(2)}`;
  const { rows } = await pool.query(
    `INSERT INTO product_orders
       (seller_id, buyer_id, status, payment_status, order_type,
        total_amount, platform_fee_amount, seller_payout_amount,
        client_checkout_token, created_at, updated_at)
     VALUES ($1,$2,'PAYMENT_PENDING',$3,'PHYSICAL',
        1000, 10, 990,
        $4, NOW() - ($5 * INTERVAL '1 minute'), NOW() - ($5 * INTERVAL '1 minute'))
     RETURNING id`,
    [sellerId, buyerId, paymentStatus, token, minutesOld]
  );
  return rows[0].id;
}

async function stateOf(id) {
  const { rows } = await pool.query(
    'SELECT status, payment_status FROM product_orders WHERE id = $1', [id]
  );
  return rows[0];
}

describe('cleanupCron.releaseExpiredUnpaidReservations (integration, real path)', () => {
  let sellerId, buyerId;
  const orderIds = [];

  before(async () => {
    await pool.query('ALTER TABLE product_orders DISABLE TRIGGER update_order_status_history_trigger').catch(() => {});
    sellerId = (await pool.query(
      `INSERT INTO sellers (full_name,email,whatsapp_number,shop_name,status)
       VALUES ('S','s@byblos.test','07','Shop-${uniq}','active') RETURNING id`
    )).rows[0].id;
    buyerId = (await pool.query(
      `INSERT INTO buyers (full_name,email,mobile_payment,refunds)
       VALUES ('B','b-${uniq}@byblos.test','0712345678',0) RETURNING id`
    )).rows[0].id;
  });

  after(async () => {
    for (const id of orderIds) {
      await pool.query('DELETE FROM product_orders WHERE id = $1', [id]).catch(() => {});
    }
    await pool.query('DELETE FROM buyers WHERE id = $1', [buyerId]).catch(() => {});
    await pool.query('DELETE FROM sellers WHERE id = $1', [sellerId]).catch(() => {});
  });

  it('cancels an unpaid order older than 15 minutes', async () => {
    const id = await makeOrder({ paymentStatus: 'pending', minutesOld: 20, sellerId, buyerId });
    orderIds.push(id);

    const result = await releaseExpiredUnpaidReservations(pool);
    assert.ok(result.cancelled >= 1, 'at least one order cancelled');

    const s = await stateOf(id);
    assert.equal(s.payment_status, 'failed');
    assert.equal(s.status, 'CANCELLED');
  });

  it('is idempotent — a second run does not re-process the already-failed order', async () => {
    // The order from the previous test is now payment_status='failed', so a second
    // sweep must not select or touch it again.
    const before = await stateOf(orderIds[0]);
    await releaseExpiredUnpaidReservations(pool);
    const after = await stateOf(orderIds[0]);
    assert.deepEqual(after, before, 'already-cancelled order is untouched by a re-run');
  });

  it('NEVER cancels a PAID order, even if old (the race-safety guard)', async () => {
    const id = await makeOrder({ paymentStatus: 'completed', minutesOld: 30, sellerId, buyerId });
    orderIds.push(id);

    await releaseExpiredUnpaidReservations(pool);

    const s = await stateOf(id);
    assert.equal(s.payment_status, 'completed', 'paid order must not be failed');
    assert.equal(s.status, 'PAYMENT_PENDING', 'paid order status is untouched (not cancelled)');
  });

  it('leaves a recent (<15m) unpaid order alone', async () => {
    const id = await makeOrder({ paymentStatus: 'pending', minutesOld: 5, sellerId, buyerId });
    orderIds.push(id);

    await releaseExpiredUnpaidReservations(pool);

    const s = await stateOf(id);
    assert.equal(s.payment_status, 'pending', 'recent order stays pending');
  });
});
