import { pool } from '../../infrastructure/database/database.js';
import getRedisClient from '../../shared/config/redis.js';
import { LogisticsQuoteService, DEFAULT_HUB } from './logisticsQuote.service.js';
import { AppError } from '../../shared/utils/errorHandler.js';
import logger from '../../shared/utils/logger.js';
import {
  URBAN_DETOUR_FACTOR,
  getTrafficVelocityKmPerHour,
  calculateEtaMinutes,
  calculatePhysicalProgress
} from './logisticsEtaMath.js';

export {
  URBAN_DETOUR_FACTOR,
  getTrafficVelocityKmPerHour,
  calculateEtaMinutes,
  calculatePhysicalProgress
};

const GPS_CACHE_TTL_SECONDS = 300; // 5 minutes
const STALE_LOCATION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export class LogisticsEtaService {
  /**
   * Records live rider GPS position, calculates ETA & monotonic progress,
   * and stores ephemeral state into Redis with 300s TTL.
   */
  static async recordRiderLocation({
    partnerId,
    legId,
    latitude,
    longitude,
    accuracy = null,
    speed = null,
    heading = null,
    timestamp = Date.now()
  }) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const safeAccuracy = accuracy !== null ? Number(accuracy) : null;
    const safeSpeed = speed !== null ? Number(speed) : null;
    const clientTimestamp = Number(timestamp) || Date.now();

    // 1. Validate coordinates
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new AppError('Invalid latitude value', 400);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new AppError('Invalid longitude value', 400);
    }

    // 2. Reject noisy GPS points (accuracy > 50 meters)
    if (safeAccuracy !== null && safeAccuracy > 50) {
      logger.warn(`[LogisticsEta] Discarded low-accuracy GPS point (${safeAccuracy}m) for leg ${legId}`);
      return { recorded: false, reason: 'low_accuracy' };
    }

    // 3. Reject future or stale timestamps (> 60s skew)
    const now = Date.now();
    if (Math.abs(now - clientTimestamp) > 60 * 1000) {
      logger.warn(`[LogisticsEta] Discarded timestamp skew for leg ${legId}: ${clientTimestamp} vs server ${now}`);
    }

    // 4. Fetch leg details and destination from DB
    const { rows } = await pool.query(
      `SELECT ll.id, ll.logistics_request_id, ll.leg_type, ll.status,
              ll.destination_lat, ll.destination_lng, ll.distance_km,
              lr.order_id, lr.partner_id
       FROM logistics_legs ll
       JOIN logistics_requests lr ON lr.id = ll.logistics_request_id
       WHERE ll.id = $1`,
      [legId]
    );

    if (!rows[0]) {
      throw new AppError('Logistics leg not found', 404);
    }

    const leg = rows[0];

    // 5. Verify partner ownership
    if (partnerId && String(leg.partner_id) !== String(partnerId)) {
      throw new AppError('Unauthorized: Partner is not assigned to this logistics leg', 403);
    }

    // 6. Verify leg is active for tracking
    if (!['started', 'out_for_delivery'].includes(leg.status)) {
      return { recorded: false, reason: 'leg_not_in_transit', status: leg.status };
    }

    // Determine target destination coordinates
    let destLat = leg.destination_lat ? Number(leg.destination_lat) : null;
    let destLng = leg.destination_lng ? Number(leg.destination_lng) : null;

    if (!destLat || !destLng) {
      // Fallback to CBD hub if destination coordinates missing
      destLat = DEFAULT_HUB.latitude;
      destLng = DEFAULT_HUB.longitude;
    }

    // 7. Compute remaining distance via Haversine
    const remainingKm = LogisticsQuoteService.calculateDistanceKm(
      { latitude: lat, longitude: lng },
      { latitude: destLat, longitude: destLng }
    );

    const totalLegKm = Number(leg.distance_km) || Math.max(1, remainingKm);
    const velocityKmH = getTrafficVelocityKmPerHour(new Date());
    const etaMinutes = calculateEtaMinutes(remainingKm, velocityKmH);
    const estimatedArrival = new Date(now + etaMinutes * 60 * 1000).toISOString();

    const rawProgress = calculatePhysicalProgress(totalLegKm, remainingKm);

    // 8. Retrieve previous progress from Redis for monotonic clamping
    const redis = getRedisClient();
    const legCacheKey = `logistics:leg:${legId}:live_eta`;
    let smoothedProgress = rawProgress;

    try {
      const cached = await redis.get(legCacheKey);
      if (cached) {
        const prev = JSON.parse(cached);
        if (typeof prev.routeProgress === 'number') {
          // Progress must never jump backward due to temporary GPS noise
          smoothedProgress = Math.max(prev.routeProgress, rawProgress);
        }
      }
    } catch (cacheErr) {
      logger.warn('[LogisticsEta] Redis read failed, proceeding with raw progress:', cacheErr.message);
    }

    // Snapping logic when close to destination
    const isArriving = remainingKm <= 0.15; // Within 150m
    const finalProgress = isArriving ? 0.95 : smoothedProgress;
    const finalEtaMinutes = isArriving ? 1 : etaMinutes;

    const etaPayload = {
      orderId: String(leg.order_id),
      legId: String(leg.id),
      trackingStatus: isArriving ? 'arriving' : 'in_transit',
      etaMinutes: finalEtaMinutes,
      estimatedArrival,
      routeProgress: finalProgress,
      lastUpdatedAt: new Date().toISOString(),
      isStale: false
    };

    // 9. Cache in Redis with 300s TTL (ephemeral, no persistent DB writes on GPS streams)
    try {
      await redis.set(legCacheKey, JSON.stringify(etaPayload), 'EX', GPS_CACHE_TTL_SECONDS);
      await redis.set(`logistics:order:${leg.order_id}:active_eta`, JSON.stringify(etaPayload), 'EX', GPS_CACHE_TTL_SECONDS);
    } catch (cacheErr) {
      logger.warn('[LogisticsEta] Redis write failed:', cacheErr.message);
    }

    return {
      recorded: true,
      eta: etaPayload
    };
  }

  /**
   * Retrieves sanitized live ETA for an order.
   * STRICT SECURITY: Zero coordinates, zero speeds, zero raw GPS data returned.
   */
  static async getOrderLiveEta({ orderId, user }) {
    if (!orderId) throw new AppError('Order ID is required', 400);

    // 1. Fetch order for tenant ownership verification
    const { rows: orderRows } = await pool.query(
      `SELECT id, buyer_id, seller_id, status, fulfillment_type, updated_at, created_at
       FROM product_orders
       WHERE id = $1`,
      [orderId]
    );

    if (!orderRows[0]) {
      throw new AppError('Order not found', 404);
    }

    const order = orderRows[0];

    // 2. Validate tenant ownership
    const isBuyer = user && (String(order.buyer_id) === String(user.profile_id) || String(order.buyer_id) === String(user.id));
    const isSeller = user && (String(order.seller_id) === String(user.sellerId) || String(order.seller_id) === String(user.profile_id) || String(order.seller_id) === String(user.id));
    const isAdmin = user && ['admin', 'logistics'].includes(user.role || user.userType);

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError('Unauthorized access to order tracking', 403);
    }

    // 3. If order is already completed
    if (order.status === 'COMPLETED') {
      return {
        orderId: String(order.id),
        legId: null,
        trackingStatus: 'delivered',
        etaMinutes: 0,
        estimatedArrival: null,
        routeProgress: 1.0,
        lastUpdatedAt: order.updated_at ? new Date(order.updated_at).toISOString() : new Date().toISOString(),
        isStale: false
      };
    }

    // 4. Query active logistics leg for this order
    const { rows: legRows } = await pool.query(
      `SELECT ll.id, ll.leg_type, ll.status, ll.distance_km, ll.deadline_at, ll.started_at
       FROM logistics_requests lr
       JOIN logistics_legs ll ON ll.logistics_request_id = lr.id
       WHERE lr.order_id = $1
         AND ll.status IN ('started', 'out_for_delivery', 'assigned', 'pending', 'delivery_pending')
       ORDER BY CASE
         WHEN ll.status = 'out_for_delivery' THEN 1
         WHEN ll.status = 'started' THEN 2
         WHEN ll.status = 'assigned' THEN 3
         ELSE 4
       END ASC
       LIMIT 1`,
      [orderId]
    );

    const activeLeg = legRows[0];

    // If no active leg in transit
    if (!activeLeg || !['started', 'out_for_delivery'].includes(activeLeg.status)) {
      return {
        orderId: String(order.id),
        legId: activeLeg ? String(activeLeg.id) : null,
        trackingStatus: activeLeg?.status || 'preparing',
        etaMinutes: null,
        estimatedArrival: activeLeg?.deadline_at || null,
        routeProgress: 0.0,
        lastUpdatedAt: null,
        isStale: false
      };
    }

    // 5. Query live ETA from Redis cache
    const redis = getRedisClient();
    const legCacheKey = `logistics:leg:${activeLeg.id}:live_eta`;

    try {
      const cached = await redis.get(legCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const ageMs = Date.now() - new Date(parsed.lastUpdatedAt).getTime();
        const isStale = ageMs > STALE_LOCATION_THRESHOLD_MS;

        return {
          orderId: String(order.id),
          legId: String(activeLeg.id),
          trackingStatus: parsed.trackingStatus || 'in_transit',
          etaMinutes: parsed.etaMinutes,
          estimatedArrival: parsed.estimatedArrival,
          routeProgress: parsed.routeProgress,
          lastUpdatedAt: parsed.lastUpdatedAt,
          isStale
        };
      }
    } catch (cacheErr) {
      logger.warn('[LogisticsEta] Redis lookup failed, returning fallback:', cacheErr.message);
    }

    // 6. Fallback when rider has started but no GPS received yet
    return {
      orderId: String(order.id),
      legId: String(activeLeg.id),
      trackingStatus: 'waiting_for_location',
      etaMinutes: null,
      estimatedArrival: activeLeg.deadline_at || null,
      routeProgress: 0.05,
      lastUpdatedAt: null,
      isStale: false
    };
  }
}

export default LogisticsEtaService;
