// Integration tests for race conditions specifically — two genuinely
// concurrent operations firing at the same time (Promise.allSettled, not
// sequential awaits), proving the row locks / dedupe keys actually
// serialize them under real Postgres concurrency rather than just looking
// correct when read.
//
// Reuses the narrowly-scoped webhook test app pattern from
// paystackWebhook.integration.test.js (see that file's header for why the
// full app isn't booted).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import webhookRoutes from '../src/application/routes/webhook.routes.js';

const { pool } = await import('../src/infrastructure/database/database.js');
const WithdrawalService = (await import('../src/domains/payments/withdrawals/withdrawal.service.js')).default;
const CreatorService = (await import('../src/domains/growth/creators/creator.service.js')).default;
const {
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
} = await import('./helpers/factories.js');

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use('/api/webhooks', webhookRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function signPayload(rawBody) {
  return crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
}

async function postWebhook(payload) {
  const rawBody = JSON.stringify(payload);
  const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signPayload(rawBody) },
    body: rawBody
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('Concurrency: two identical webhook deliveries racing each other', () => {
  test('exactly one delivery processes the payment; fulfillment is enqueued exactly once', async (t) => {
    let buyer, seller, order, payment;
    t.after(async () => {
      if (payment) await pool.query('DELETE FROM webhook_replay_dedupe WHERE provider_reference = $1', [payment.invoice_id]).catch(() => {});
      if (order) await cleanupOrder(order.id).catch(() => {});
      if (seller) await cleanupSeller(seller.id).catch(() => {});
      if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
    });

    buyer = await createBuyer({});
    seller = await createSeller({});
    order = await createCompletedOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      totalAmount: 600,
      sellerPayoutAmount: 590,
      platformFeeAmount: 10
    });
    await pool.query("UPDATE product_orders SET status = 'PENDING', payment_status = 'pending' WHERE id = $1", [order.id]);

    const reference = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { rows: [insertedPayment] } = await pool.query(
      `INSERT INTO payments (invoice_id, amount, status, order_id, metadata)
       VALUES ($1, $2, 'pending', $3, $4::jsonb) RETURNING *`,
      [reference, 600, order.id, JSON.stringify({ order_id: order.id })]
    );
    payment = insertedPayment;

    const payload = {
      event: 'charge.success',
      data: {
        reference,
        amount: 60000,
        currency: 'KES',
        status: 'success',
        paid_at: new Date().toISOString(),
        channel: 'mobile_money',
        customer: { email: 'race-test@byblos.local' }
      }
    };

    // Genuinely concurrent — both fired before either has a chance to respond.
    const [first, second] = await Promise.all([postWebhook(payload), postWebhook(payload)]);

    // Both requests must get an HTTP response the caller can trust (either
    // "processed" or "already processing/processed") — neither should ever
    // 500 or hang. Exactly one must be the one that actually did the work.
    const statuses = [first.status, second.status].sort();
    assert.ok(
      statuses[0] === 200 || statuses[0] === 409,
      `unexpected status combination: ${JSON.stringify(statuses)}`
    );

    const { rows: paymentRows } = await pool.query('SELECT status FROM payments WHERE id = $1', [payment.id]);
    assert.equal(paymentRows[0].status, 'completed');

    const { rows: orderRows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [order.id]);
    assert.equal(orderRows[0].status, 'PAID');

    // THE CONCURRENCY ASSERTION: fulfillment must be enqueued exactly once,
    // not once per concurrent delivery — this is only possible if the
    // replay-dedupe row lock actually serialized the two requests rather
    // than letting both reach the payment controller.
    const { rows: jobRows } = await pool.query('SELECT COUNT(*)::int AS n FROM fulfillment_jobs WHERE order_id = $1', [order.id]);
    assert.equal(jobRows[0].n, 1);

    const { rows: dedupeRows } = await pool.query(
      'SELECT status, attempts FROM webhook_replay_dedupe WHERE provider_reference = $1',
      [reference]
    );
    assert.equal(dedupeRows.length, 1, 'one dedupe row for the one logical event, regardless of delivery count');
    assert.equal(dedupeRows[0].status, 'completed');
  });
});

describe('Concurrency: two withdrawal requests racing against the same balance', () => {
  test('only one of two overlapping withdrawals succeeds; the balance is never overdrawn', async (t) => {
    let creator;
    t.after(async () => {
      if (!creator) return;
      // The winning withdrawal fires a real (unawaited, fire-and-forget by
      // design — see WithdrawalService.createWithdrawalRequest) background
      // call to the payout provider, which keeps writing to
      // payout_provider_attempts/withdrawal_requests for a short while after
      // this test's own assertions finish. Retry cleanup briefly rather than
      // asserting a hard timing boundary that would make this test flaky.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await pool.query('DELETE FROM payout_provider_attempts WHERE creator_id = $1', [creator.id]);
          await pool.query('DELETE FROM withdrawal_requests WHERE creator_id = $1', [creator.id]);
          await cleanupCreator(creator.id);
          return;
        } catch (error) {
          if (attempt === 4) throw error;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    });

    creator = await createCreator({});
    // No earnings rows -> getCreatorClearance treats the whole balance as
    // available; set directly so this test is about the row lock, not T+2.
    await pool.query('UPDATE creators SET balance = 150 WHERE id = $1', [creator.id]);

    // Two DIFFERENT idempotency keys (a shared key would just dedupe, which
    // is a different, already-covered code path) each requesting 80 KES.
    // 80 + the 21 KES fee = 101; one fits in a 150 balance, two (202) do not.
    const [first, second] = await Promise.allSettled([
      WithdrawalService.createWithdrawalRequest({
        entityId: creator.id, entityType: 'creator', amount: 80, idempotencyKey: `race-a-${Date.now()}`
      }),
      WithdrawalService.createWithdrawalRequest({
        entityId: creator.id, entityType: 'creator', amount: 80, idempotencyKey: `race-b-${Date.now()}`
      })
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exactly one concurrent withdrawal must succeed');
    assert.equal(rejected.length, 1, 'exactly one concurrent withdrawal must be rejected');
    assert.match(rejected[0].reason.message, /insufficient balance/i);

    // THE CONCURRENCY ASSERTION: only one withdrawal_requests row was ever
    // created — the loser's transaction rolled back before inserting
    // anything, proving the FOR UPDATE lock on the creator row serialized
    // the two attempts rather than letting both reserve funds. This row is
    // the durable proof the winning request committed its reservation.
    const { rows: withdrawalRows } = await pool.query('SELECT amount FROM withdrawal_requests WHERE creator_id = $1', [creator.id]);
    assert.equal(withdrawalRows.length, 1);
    assert.equal(Number(withdrawalRows[0].amount), 80);

    // CONSERVATION INVARIANT (timing-independent): the money is never
    // overdrawn and never created out of thin air. We deliberately do NOT
    // assert the exact final balance: the winning request fires an unawaited,
    // fire-and-forget payout to the provider whose success/failure — and the
    // resulting reserve/un-reserve of the balance — completes asynchronously
    // after this point (and, against the mock provider URL, fails and reverses
    // the reservation). The lock behaviour under test is fully proven by the
    // single winner above; the final balance depends on that async payout and
    // is asserted only within its safe bounds so this stays deterministic.
    const { rows: creatorRows } = await pool.query('SELECT balance, withdrawal_reserved_balance FROM creators WHERE id = $1', [creator.id]);
    const balance = Number(creatorRows[0].balance);
    const reserved = Number(creatorRows[0].withdrawal_reserved_balance || 0);
    assert.ok(balance >= 0, 'balance must never go negative');
    assert.ok(balance <= 150, 'balance must never exceed the starting balance — no money created');
    assert.ok(balance + reserved <= 150, 'balance + reserved must never exceed the starting 150 — funds are conserved, never double-counted');
  });
});

describe('Concurrency: two admin resolutions racing on the same flagged earning', () => {
  test('only one of two concurrent reversals is applied; the balance is decremented exactly once', async (t) => {
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

    // Two genuinely concurrent admins resolving the SAME flagged earning as
    // "reverse" — only one may actually claw back the 50 KES.
    const [first, second] = await Promise.allSettled([
      CreatorService.resolveFlaggedEarning({ earningType: 'sales', earningId: inserted.id, adminId: admin.id, action: 'reverse', notes: 'race A' }),
      CreatorService.resolveFlaggedEarning({ earningType: 'sales', earningId: inserted.id, adminId: admin.id, action: 'reverse', notes: 'race B' })
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'exactly one concurrent resolution must succeed');
    assert.equal(rejected.length, 1, 'exactly one concurrent resolution must be rejected');
    assert.match(rejected[0].reason.message, /already reversed|not currently flagged/i);

    // THE CONCURRENCY ASSERTION: the balance must be decremented exactly
    // once (50), never twice (which a double-reversal would produce as a
    // negative balance or an incorrect deficit) — proving the row lock
    // inside _reverseSingleEarning correctly serialized the two admins.
    const { rows: creatorRows } = await pool.query('SELECT balance FROM creators WHERE id = $1', [creator.id]);
    assert.equal(Number(creatorRows[0].balance), 0, 'balance must be exactly 50 - 50 = 0, not negative from a double reversal');

    const { rows: earningRows } = await pool.query('SELECT status FROM creator_earnings WHERE id = $1', [inserted.id]);
    assert.equal(earningRows[0].status, 'reversed');
  });
});
