// Integration test for the Paystack webhook pipeline against a real,
// running Express app and a real database — not mocked middleware, not
// direct function calls. Rather than booting the FULL app (which mounts
// unrelated routes — auth, admin, etc. — some of which construct a
// rate-limit-redis Store at import time; that constructor talks to Redis
// synchronously and, with no Redis in this environment,
// `enableOfflineQueue: false` in test mode — deliberately set to avoid
// hanging — makes it throw instead of queuing, crashing the whole process
// before a single request is even sent), this mounts ONLY the real webhook
// route (webhook.routes.js, completely unchanged) on a minimal app with the
// same raw-body-capturing JSON parser the real app uses. Everything this
// test actually exercises — verifyPaystackWebhook, webhookRateLimiter,
// requirePaystackWebhookHmac, handleUnifiedPaystackWebhook,
// CorePaymentService.completeVerifiedPayment — is the real, unmodified
// production code; only the unrelated surrounding app (auth/admin routes,
// CORS, helmet, etc.) is left out because this test has no business
// depending on it.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import webhookRoutes from '../src/application/routes/webhook.routes.js';

const { pool } = await import('../src/infrastructure/database/database.js');
const {
  createBuyer,
  createSeller,
  createCompletedOrder,
  cleanupOrder,
  cleanupSeller,
  cleanupBuyer
} = await import('./helpers/factories.js');

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
  }));
  app.use('/api/webhooks', webhookRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function signPaystackPayload(rawBody) {
  return crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
}

async function postWebhook(payload, { signature } = {}) {
  const rawBody = JSON.stringify(payload);
  const sig = signature !== undefined ? signature : signPaystackPayload(rawBody);
  const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': sig
    },
    body: rawBody
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/**
 * Builds a normal, in-order product_orders row that a webhook can complete:
 * status PENDING (payment not yet confirmed), and a matching `payments` row
 * with a known invoice_id/reference for the webhook to look up by.
 */
async function createPendingOrderAndPayment({ totalAmountKes }) {
  const buyer = await createBuyer({});
  const seller = await createSeller({});
  const order = await createCompletedOrder({
    buyerId: buyer.id,
    sellerId: seller.id,
    totalAmount: totalAmountKes,
    sellerPayoutAmount: totalAmountKes - 10,
    platformFeeAmount: 10
  });
  // createCompletedOrder defaults to COMPLETED for the escrow tests; this
  // suite needs a pre-payment order, so reset it to PENDING here.
  await pool.query("UPDATE product_orders SET status = 'PENDING', payment_status = 'pending' WHERE id = $1", [order.id]);

  const reference = `webhook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { rows: [payment] } = await pool.query(
    `INSERT INTO payments (invoice_id, amount, status, order_id, metadata)
     VALUES ($1, $2, 'pending', $3, $4::jsonb)
     RETURNING *`,
    [reference, totalAmountKes, order.id, JSON.stringify({ order_id: order.id })]
  );

  return { buyer, seller, order, payment, reference };
}

async function cleanupAll({ order, seller, buyer, reference }) {
  // webhook_replay_dedupe is keyed by a derived event_id, not order_id, so
  // cleanupOrder (FK-scoped) never touches it — clean it up separately by
  // provider_reference or it accumulates indefinitely across test runs.
  if (reference) await pool.query('DELETE FROM webhook_replay_dedupe WHERE provider_reference = $1', [reference]).catch(() => {});
  if (order) await cleanupOrder(order.id).catch(() => {});
  if (seller) await cleanupSeller(seller.id).catch(() => {});
  if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
}

function chargeSuccessPayload({ reference, amountKes }) {
  return {
    event: 'charge.success',
    data: {
      reference,
      amount: Math.round(amountKes * 100), // Paystack amounts are in subunits
      currency: 'KES',
      status: 'success',
      paid_at: new Date().toISOString(),
      channel: 'mobile_money',
      gateway_response: 'Successful',
      customer: { email: 'webhook-test@byblos.local' }
    }
  };
}

describe('Paystack webhook (integration, real HTTP + real signature)', () => {
  test('a validly-signed charge.success webhook completes the payment and marks the order PAID', async (t) => {
    let fixtures;
    t.after(() => cleanupAll(fixtures));

    fixtures = await createPendingOrderAndPayment({ totalAmountKes: 1000 });
    const { status, body } = await postWebhook(chargeSuccessPayload({ reference: fixtures.reference, amountKes: 1000 }));

    assert.equal(status, 200);
    assert.equal(body.status, 'success');

    const { rows: paymentRows } = await pool.query('SELECT status FROM payments WHERE id = $1', [fixtures.payment.id]);
    assert.equal(paymentRows[0].status, 'completed');

    const { rows: orderRows } = await pool.query('SELECT status, payment_status FROM product_orders WHERE id = $1', [fixtures.order.id]);
    assert.equal(orderRows[0].status, 'PAID');
    assert.equal(orderRows[0].payment_status, 'completed');
  });

  test('rejects a webhook with an invalid signature — payment stays untouched', async (t) => {
    let fixtures;
    t.after(() => cleanupAll(fixtures));

    fixtures = await createPendingOrderAndPayment({ totalAmountKes: 500 });
    const badSignature = 'a'.repeat(128); // well-formed hex, wrong value
    const { status } = await postWebhook(chargeSuccessPayload({ reference: fixtures.reference, amountKes: 500 }), { signature: badSignature });

    assert.equal(status, 401);

    const { rows: paymentRows } = await pool.query('SELECT status FROM payments WHERE id = $1', [fixtures.payment.id]);
    assert.equal(paymentRows[0].status, 'pending', 'an invalid signature must never complete a payment');
  });

  test('replaying the identical webhook does not re-process or double-transition the order', async (t) => {
    let fixtures;
    t.after(() => cleanupAll(fixtures));

    fixtures = await createPendingOrderAndPayment({ totalAmountKes: 750 });
    const payload = chargeSuccessPayload({ reference: fixtures.reference, amountKes: 750 });

    const first = await postWebhook(payload);
    assert.equal(first.status, 200);

    const { rows: afterFirst } = await pool.query('SELECT updated_at FROM product_orders WHERE id = $1', [fixtures.order.id]);

    // Identical payload + identical signature = identical replay-dedupe key.
    // Paystack itself resends on any non-2xx, so this must be a safe no-op.
    const second = await postWebhook(payload);
    assert.equal(second.status, 200);
    assert.match(second.body.message || '', /already processed/i);

    const { rows: afterSecond } = await pool.query('SELECT updated_at, status FROM product_orders WHERE id = $1', [fixtures.order.id]);
    assert.equal(afterSecond[0].status, 'PAID');
    assert.equal(
      afterSecond[0].updated_at.getTime(),
      afterFirst[0].updated_at.getTime(),
      'the replay must not touch the order a second time'
    );

    const { rows: dedupeRows } = await pool.query(
      "SELECT status, attempts FROM webhook_replay_dedupe WHERE provider_reference = $1",
      [fixtures.reference]
    );
    assert.equal(dedupeRows.length, 1, 'one dedupe row per distinct webhook event, not one per delivery attempt');
    assert.equal(dedupeRows[0].status, 'completed');
  });

  test('an amount mismatch is routed to manual review instead of completing the payment (fraud detection)', async (t) => {
    let fixtures;
    t.after(() => cleanupAll(fixtures));

    fixtures = await createPendingOrderAndPayment({ totalAmountKes: 1000 });
    // Provider claims only 1 KES was paid against a 1000 KES payment record.
    const { status, body } = await postWebhook(chargeSuccessPayload({ reference: fixtures.reference, amountKes: 1 }));

    assert.equal(status, 200, 'the webhook endpoint still acks 200 — the mismatch is handled internally, not surfaced as a delivery failure');
    assert.equal(body.status, 'success');

    const { rows: paymentRows } = await pool.query('SELECT status FROM payments WHERE id = $1', [fixtures.payment.id]);
    assert.equal(paymentRows[0].status, 'manual_review_required');

    const { rows: orderRows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [fixtures.order.id]);
    assert.equal(orderRows[0].status, 'PENDING', 'the order must not be marked PAID on a mismatched amount');

    const { rows: fraudRows } = await pool.query(
      "SELECT event_type FROM fraud_events WHERE payment_id = $1 AND event_type = 'amount_mismatch'",
      [fixtures.payment.id]
    );
    assert.equal(fraudRows.length, 1);
  });
});
