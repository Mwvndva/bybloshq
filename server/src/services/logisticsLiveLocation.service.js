import getRedisClient from '../config/redis.js';
import { pool } from '../shared/db/database.js';
import { AppError } from '../shared/utils/errorHandler.js';

// Live courier location for the "track my delivery as it commutes" feature.
//
// Storage is Redis-only (no DB table): the courier's device posts its position
// while a package is moving, and buyers/sellers poll for the last-known point.
// A short TTL means a stale/parked courier simply drops off the map instead of
// showing a frozen position forever. Visibility is PHASE-SCOPED, enforced by
// the read side: the seller may only see the courier during the pickup leg
// (courier → seller), the buyer only during delivery (courier → buyer), so
// neither watches the courier reach the other party's address.

const TTL_SECONDS = Number(process.env.LOGISTICS_LIVE_LOCATION_TTL_SECONDS) || 180;
const keyFor = (requestId) => `logistics:live:${requestId}`;

function toFiniteNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min !== undefined && n < min) return null;
  if (max !== undefined && n > max) return null;
  return n;
}

/** A pickup leg the courier is actively travelling to the seller for. */
export function isPickupTrackable(status) {
  const s = String(status || '').toLowerCase();
  if (/picked|dropped|failed|cancelled/.test(s)) return false;
  return /assigned|started|out_for_pickup|en_route/.test(s);
}

/** A delivery leg the courier is actively out for. */
export function isDeliveryTrackable(status) {
  const s = String(status || '').toLowerCase();
  return /out_for_delivery|out for delivery/.test(s);
}

/**
 * Courier posts its current position for one logistics request it owns.
 * Ownership (request belongs to this partner) is verified before writing.
 */
export async function setCourierLocation({ requestId, partnerId, lat, lng, accuracy, heading, speed }) {
  const validLat = toFiniteNumber(lat, -90, 90);
  const validLng = toFiniteNumber(lng, -180, 180);
  if (validLat === null || validLng === null) {
    throw new AppError('Valid lat/lng are required', 400);
  }

  const { rows } = await pool.query(
    `SELECT id FROM logistics_requests WHERE id = $1 AND partner_id = $2 LIMIT 1`,
    [requestId, partnerId]
  );
  if (!rows[0]) {
    throw new AppError('Logistics request not found for this partner', 404);
  }

  const payload = {
    lat: validLat,
    lng: validLng,
    accuracy: toFiniteNumber(accuracy),
    heading: toFiniteNumber(heading),
    speed: toFiniteNumber(speed),
    updatedAt: new Date().toISOString(),
  };

  const redis = getRedisClient();
  await redis.set(keyFor(requestId), JSON.stringify(payload), 'EX', TTL_SECONDS);
  return { updatedAt: payload.updatedAt };
}

/** Last-known courier position for a request, or null if none/expired. */
export async function getCourierLocation(requestId) {
  const redis = getRedisClient();
  const raw = await redis.get(keyFor(requestId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Phase-scoped read for a buyer or seller. Resolves the order's logistics
 * request + leg statuses, checks ownership, and only returns the location when
 * the caller's own leg is the one currently in motion.
 */
export async function getLiveLocationForOrder({ orderId, buyerId, sellerId }) {
  const { rows } = await pool.query(
    `SELECT
        po.buyer_id,
        po.seller_id,
        lr.id AS request_id,
        dl.status AS delivery_status,
        pl.status AS pickup_status
     FROM product_orders po
     JOIN logistics_requests lr ON lr.order_id = po.id
     LEFT JOIN logistics_legs dl ON dl.logistics_request_id = lr.id AND dl.leg_type = 'delivery'
     LEFT JOIN logistics_legs pl ON pl.logistics_request_id = lr.id AND pl.leg_type = 'pickup'
     WHERE po.id = $1
     LIMIT 1`,
    [orderId]
  );

  const row = rows[0];
  if (!row) {
    return { available: false, phase: null, location: null };
  }

  const isBuyer = Boolean(buyerId) && String(row.buyer_id) === String(buyerId);
  const isSeller = Boolean(sellerId) && String(row.seller_id) === String(sellerId);
  if (!isBuyer && !isSeller) {
    throw new AppError('You are not allowed to track this order', 403);
  }

  const buyerMaySee = isBuyer && isDeliveryTrackable(row.delivery_status);
  const sellerMaySee = isSeller && isPickupTrackable(row.pickup_status);
  if (!buyerMaySee && !sellerMaySee) {
    return { available: false, phase: null, location: null };
  }

  const location = await getCourierLocation(row.request_id);
  return {
    available: Boolean(location),
    phase: buyerMaySee ? 'delivery' : 'pickup',
    location,
  };
}
