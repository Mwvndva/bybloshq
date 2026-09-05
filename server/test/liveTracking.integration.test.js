// Integration tests for the public live order-tracking feature
// (GET /api/tracking/:token -> LogisticsTrackingLinkService.getSafeTrackingByToken).
// Exercises the REAL service against a REAL database with REAL HMAC-signed
// tokens minted by the real link service — covering the tracking view, the
// event timeline, the buyer/seller privacy redaction, token tamper-rejection,
// and the "not active yet" status gate.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const LogisticsTrackingLinkService = (await import('../src/domains/logistics/logisticsTrackingLink.service.js')).default;
const { createBuyer, createSeller, createCompletedOrder, cleanupOrder, cleanupSeller, cleanupBuyer } =
  await import('./helpers/factories.js');

const BUYER_ADDRESS = '742 Evergreen Terrace, Springfield';
const SELLER_ADDRESS = 'Test Atelier, Biashara St, Nairobi';

async function getMzigoPartnerId() {
  const { rows } = await pool.query(`SELECT id FROM logistics_partners WHERE slug = 'mzigo-ego' LIMIT 1`);
  if (!rows[0]) throw new Error('mzigo-ego partner missing from test DB');
  return rows[0].id;
}

/**
 * Builds a fully-tracked order: order + logistics_request (given status) +
 * pickup & delivery legs + a couple of tracking events + the buyer/seller
 * tracking links (minted by the real ensureLinksForRequest). Returns ids and
 * the real signed tokens for each audience.
 */
async function seedTrackedOrder({ requestStatus = 'active' } = {}) {
  const partnerId = await getMzigoPartnerId();
  const buyer = await createBuyer({});
  const seller = await createSeller({});
  const order = await createCompletedOrder({
    buyerId: buyer.id, sellerId: seller.id, totalAmount: 1200, sellerPayoutAmount: 1190, platformFeeAmount: 10
  });

  const { rows: [req] } = await pool.query(
    `INSERT INTO logistics_requests (order_id, partner_id, package_code, status, service_level, deadline_at)
     VALUES ($1, $2, $3, $4, 'standard', NOW() + INTERVAL '24 hours') RETURNING id`,
    [order.id, partnerId, `BYB-LOG-${order.id}`, requestStatus]
  );
  const requestId = req.id;

  await pool.query(
    `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, origin_label, origin_address)
     VALUES ($1, 'pickup', 'seller', 'dropped_at_hub', 'Seller', $2)`,
    [requestId, SELLER_ADDRESS]
  );
  await pool.query(
    `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, destination_label, destination_address)
     VALUES ($1, 'delivery', 'buyer', 'out_for_delivery', 'Buyer home', $2)`,
    [requestId, BUYER_ADDRESS]
  );

  await pool.query(
    `INSERT INTO logistics_tracking_events (logistics_request_id, event_type, status, message, source, created_at)
     VALUES ($1, 'pickup.dropped_at_hub', 'dropped_at_hub', 'Package dropped at the hub.', 'mzigo', NOW() - INTERVAL '2 hours'),
            ($1, 'delivery.out_for_delivery', 'out_for_delivery', 'Package is out for delivery.', 'mzigo', NOW() - INTERVAL '1 hour')`,
    [requestId]
  );

  const client = await pool.connect();
  try {
    await LogisticsTrackingLinkService.ensureLinksForRequest(client, requestId);
  } finally {
    client.release();
  }
  const links = await LogisticsTrackingLinkService.getLinksForRequest(requestId);

  return { buyer, seller, order, requestId, tokens: { buyer: links.buyer?.token, seller: links.seller?.token } };
}

async function cleanupTracked({ order, seller, buyer, requestId }) {
  if (requestId) {
    // logistics_tracking_events is an append-only audit table guarded by a
    // BEFORE DELETE/UPDATE "immutable" trigger, so a plain DELETE raises. For
    // test teardown we bypass user triggers on a single connection via
    // session_replication_role = replica (superuser-scoped: DB_USER is postgres
    // locally and in CI), delete children-first, then restore the setting.
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica'");
      await client.query('DELETE FROM logistics_tracking_events WHERE logistics_request_id = $1', [requestId]);
      await client.query('DELETE FROM logistics_tracking_links WHERE logistics_request_id = $1', [requestId]);
      await client.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]);
      await client.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]);
    } catch { /* best-effort teardown */ } finally {
      await client.query("SET session_replication_role = 'origin'").catch(() => {});
      client.release();
    }
  }
  if (order) await cleanupOrder(order.id).catch(() => {});
  if (seller) await cleanupSeller(seller.id).catch(() => {});
  if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
}

describe('Live order tracking (public token endpoint, real DB + real HMAC tokens)', () => {
  test('a valid buyer token returns the order, live status, and the event timeline in order', async (t) => {
    let f;
    t.after(() => cleanupTracked(f || {}));
    f = await seedTrackedOrder({ requestStatus: 'active' });

    const tracking = await LogisticsTrackingLinkService.getSafeTrackingByToken(f.tokens.buyer);

    assert.equal(tracking.audience, 'buyer');
    assert.equal(tracking.orderNumber, f.order.order_number);
    assert.equal(tracking.status, 'active');
    assert.ok(tracking.delivery, 'delivery leg present');
    assert.equal(tracking.delivery.status, 'out_for_delivery');
    // Timeline reflects the tracking events, oldest-first.
    assert.equal(tracking.timeline.length, 2);
    assert.equal(tracking.timeline[0].status, 'dropped_at_hub');
    assert.equal(tracking.timeline[1].status, 'out_for_delivery');
  });

  test('privacy: the buyer sees their delivery address, the seller does not', async (t) => {
    let f;
    t.after(() => cleanupTracked(f || {}));
    f = await seedTrackedOrder({ requestStatus: 'in_progress' });

    const asBuyer = await LogisticsTrackingLinkService.getSafeTrackingByToken(f.tokens.buyer);
    const asSeller = await LogisticsTrackingLinkService.getSafeTrackingByToken(f.tokens.seller);

    // Buyer audience: their own delivery destination address is visible.
    assert.equal(asBuyer.delivery.destination.address, BUYER_ADDRESS);
    assert.equal(asBuyer.delivery.safeNote, null);

    // Seller audience: the buyer's delivery address is redacted for privacy.
    assert.equal(asSeller.delivery.destination.address, null, 'seller must NOT see the buyer delivery address');
    assert.match(asSeller.delivery.safeNote || '', /hidden for privacy/i);
  });

  test('a tampered token signature is rejected as 404', async (t) => {
    let f;
    t.after(() => cleanupTracked(f || {}));
    f = await seedTrackedOrder({ requestStatus: 'active' });

    const tampered = f.tokens.buyer.slice(0, -4) + 'AAAA'; // corrupt the HMAC signature tail
    await assert.rejects(
      () => LogisticsTrackingLinkService.getSafeTrackingByToken(tampered),
      (err) => err.statusCode === 404
    );
  });

  test('a malformed token is rejected as 404', async (t) => {
    await assert.rejects(
      () => LogisticsTrackingLinkService.getSafeTrackingByToken('not-a-real-token'),
      (err) => err.statusCode === 404
    );
  });

  test('a link for a not-yet-active request (payment_pending) is not exposed', async (t) => {
    let f;
    t.after(() => cleanupTracked(f || {}));
    f = await seedTrackedOrder({ requestStatus: 'payment_pending' });

    await assert.rejects(
      () => LogisticsTrackingLinkService.getSafeTrackingByToken(f.tokens.buyer),
      (err) => err.statusCode === 404,
      'a request that is not in a visible status must not leak tracking data'
    );
  });
});
