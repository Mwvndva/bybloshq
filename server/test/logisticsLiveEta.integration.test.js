// Integration tests for the live GPS-based ETA / route-progress layer
// (LogisticsEtaService.recordRiderLocation -> Redis -> getOrderLiveEta),
// against a REAL database and a REAL Redis. Covers GPS validation, partner
// ownership, the record->read round trip, the privacy guarantee (no raw
// coordinates/speed ever leave the service), monotonic progress, the
// "arriving" snap, order-ownership on read, and the completed / no-GPS
// fallbacks.
//
// The round-trip assertions need Redis (the ETA is cached there with a 300s
// TTL). If Redis is unreachable they self-skip rather than fail, so the suite
// stays green without Redis; CI provides a redis service, and locally a
// throwaway `redis:7-alpine` container serves it.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { pool } = await import('../src/infrastructure/database/database.js');
const getRedisClient = (await import('../src/shared/config/redis.js')).default;
const LogisticsEtaService = (await import('../src/domains/logistics/logisticsEta.service.js')).default;
const { createBuyer, createSeller, createCompletedOrder, cleanupOrder, cleanupSeller, cleanupBuyer } =
  await import('./helpers/factories.js');

// Destination (buyer) and rider sample points around Nairobi CBD.
const DEST = { lat: -1.2833, lng: 36.8167 };
const FAR = { lat: -1.2650, lng: 36.8167 };      // ~2.0 km out
const NEAR = { lat: -1.2770, lng: 36.8167 };     // ~0.7 km out
const ARRIVING = { lat: -1.2843, lng: 36.8167 }; // ~0.11 km out (<150 m)
const TOTAL_LEG_KM = 3;

let redisUp = false;
let partnerId;

before(async () => {
  const { rows } = await pool.query(`SELECT id FROM logistics_partners WHERE slug = 'mzigo-ego' LIMIT 1`);
  partnerId = rows[0]?.id;
  // The test-mode Redis client uses enableOfflineQueue:false + lazyConnect, so
  // the very first command can reject while the socket is still connecting.
  // Retry briefly to let it become ready before deciding Redis is unavailable.
  const redis = getRedisClient();
  for (let i = 0; i < 15; i += 1) {
    try {
      await (typeof redis.ping === 'function' ? redis.ping() : redis.set('__probe__', '1'));
      redisUp = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
});

async function seedInTransit({ orderStatus = 'FULFILLING', legStatus = 'out_for_delivery' } = {}) {
  const buyer = await createBuyer({});
  const seller = await createSeller({});
  const order = await createCompletedOrder({ buyerId: buyer.id, sellerId: seller.id, totalAmount: 1500, sellerPayoutAmount: 1490, platformFeeAmount: 10 });
  await pool.query('UPDATE product_orders SET status = $2 WHERE id = $1', [order.id, orderStatus]);

  const { rows: [req] } = await pool.query(
    `INSERT INTO logistics_requests (order_id, partner_id, package_code, status) VALUES ($1,$2,$3,'active') RETURNING id`,
    [order.id, partnerId, `BYB-LOG-${order.id}`]
  );
  const { rows: [leg] } = await pool.query(
    `INSERT INTO logistics_legs (logistics_request_id, leg_type, payer, status, distance_km, destination_lat, destination_lng, destination_label)
     VALUES ($1, 'delivery', 'buyer', $2, $3, $4, $5, 'Buyer home') RETURNING id`,
    [req.id, legStatus, TOTAL_LEG_KM, DEST.lat, DEST.lng]
  );
  return { buyer, seller, order, requestId: req.id, legId: leg.id };
}

async function cleanupInTransit({ order, seller, buyer, requestId, legId }) {
  if (legId) await getRedisClient().del(`logistics:leg:${legId}:live_eta`).catch(() => {});
  if (order) await getRedisClient().del(`logistics:order:${order.id}:active_eta`).catch(() => {});
  if (requestId) {
    await pool.query('DELETE FROM logistics_legs WHERE logistics_request_id = $1', [requestId]).catch(() => {});
    await pool.query('DELETE FROM logistics_requests WHERE id = $1', [requestId]).catch(() => {});
  }
  if (order) await cleanupOrder(order.id).catch(() => {});
  if (seller) await cleanupSeller(seller.id).catch(() => {});
  if (buyer) await cleanupBuyer(buyer.id).catch(() => {});
}

const record = (legId, point, extra = {}) => LogisticsEtaService.recordRiderLocation({
  partnerId, legId, latitude: point.lat, longitude: point.lng, accuracy: 10, timestamp: Date.now(), ...extra
});

describe('recordRiderLocation — validation & guards (no Redis needed)', () => {
  test('rejects an out-of-range latitude', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();
    await assert.rejects(() => record(f.legId, { lat: 999, lng: DEST.lng }), (e) => e.statusCode === 400);
  });

  test('discards a low-accuracy GPS point (>50m)', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();
    const res = await record(f.legId, FAR, { accuracy: 120 });
    assert.equal(res.recorded, false);
    assert.equal(res.reason, 'low_accuracy');
  });

  test('does not record for a leg that is not in transit', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit({ legStatus: 'assigned' });
    const res = await record(f.legId, FAR);
    assert.equal(res.recorded, false);
    assert.equal(res.reason, 'leg_not_in_transit');
  });

  test('rejects a partner that does not own the leg (403)', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();
    await assert.rejects(
      () => LogisticsEtaService.recordRiderLocation({ partnerId: 999999, legId: f.legId, latitude: FAR.lat, longitude: FAR.lng, accuracy: 10 }),
      (e) => e.statusCode === 403
    );
  });
});

describe('recordRiderLocation -> getOrderLiveEta round trip (real Redis)', () => {
  test('a recorded location yields a sanitized live ETA — with NO raw coordinates/speed', async (t) => {
    if (!redisUp) return t.skip('requires Redis');
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();

    const rec = await record(f.legId, FAR, { speed: 8, heading: 90 });
    assert.equal(rec.recorded, true);

    const eta = await LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { profile_id: f.buyer.id } });
    assert.equal(eta.trackingStatus, 'in_transit');
    assert.ok(eta.etaMinutes > 0, 'a positive ETA');
    assert.ok(eta.routeProgress > 0 && eta.routeProgress <= 0.95, 'progress within (0, 0.95]');
    assert.equal(eta.isStale, false);

    // PRIVACY GUARANTEE: no raw GPS ever leaves the service.
    for (const leaky of ['latitude', 'longitude', 'lat', 'lng', 'speed', 'heading', 'coordinates', 'accuracy']) {
      assert.ok(!(leaky in eta), `sanitized ETA must not expose "${leaky}"`);
    }
  });

  test('route progress never moves backward on GPS noise (monotonic clamp)', async (t) => {
    if (!redisUp) return t.skip('requires Redis');
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();

    await record(f.legId, FAR);   // ~0.33
    await record(f.legId, NEAR);  // ~0.77
    await record(f.legId, FAR);   // noisy jump back — must NOT reduce progress

    const eta = await LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { role: 'admin' } });
    assert.ok(eta.routeProgress >= 0.7, `progress held at the closest point, got ${eta.routeProgress}`);
  });

  test('within 150m the ETA snaps to "arriving"', async (t) => {
    if (!redisUp) return t.skip('requires Redis');
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();

    await record(f.legId, ARRIVING);
    const eta = await LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { role: 'admin' } });
    assert.equal(eta.trackingStatus, 'arriving');
    assert.equal(eta.routeProgress, 0.95);
    assert.equal(eta.etaMinutes, 1);
  });
});

describe('getOrderLiveEta — ownership & fallbacks', () => {
  test('a non-owner is refused (403)', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();
    await assert.rejects(
      () => LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { profile_id: 999999999, role: 'buyer' } }),
      (e) => e.statusCode === 403
    );
  });

  test('a completed order reports delivered at 100% progress', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit({ orderStatus: 'COMPLETED' });
    const eta = await LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { role: 'admin' } });
    assert.equal(eta.trackingStatus, 'delivered');
    assert.equal(eta.routeProgress, 1.0);
  });

  test('an in-transit leg with no GPS yet reports waiting_for_location', async (t) => {
    let f; t.after(() => cleanupInTransit(f || {}));
    f = await seedInTransit();
    // No recordRiderLocation call -> no cached ETA.
    const eta = await LogisticsEtaService.getOrderLiveEta({ orderId: f.order.id, user: { role: 'admin' } });
    assert.equal(eta.trackingStatus, 'waiting_for_location');
  });
});
