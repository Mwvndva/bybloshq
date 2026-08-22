import getRedisClient from '../../shared/config/redis.js';

/**
 * Spatial query using Redis GEOSEARCH to automatically match closest active riders within radiusKm.
 *
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @param {number} [radiusKm=5.0]
 */
export async function findNearestAvailableRiders(pickupLat, pickupLng, radiusKm = 5.0) {
  const redis = getRedisClient();

  try {
    const nearbyRiders = await redis.geosearch(
      'logistics:active_couriers',
      'FROMLONLAT', pickupLng, pickupLat,
      'BYRADIUS', radiusKm, 'km',
      'WITHDIST', 'WITHCOORD',
      'ASC'
    );

    if (!Array.isArray(nearbyRiders)) return [];

    return nearbyRiders.map(([riderId, distance, coords]) => {
      const [lng, lat] = Array.isArray(coords) ? coords : [0, 0];
      return {
        riderId: String(riderId),
        distanceKm: Number.parseFloat(distance),
        latitude: Number.parseFloat(lat),
        longitude: Number.parseFloat(lng)
      };
    });
  } catch (err) {
    return [];
  }
}

export default {
  findNearestAvailableRiders
};
