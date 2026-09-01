export const URBAN_DETOUR_FACTOR = 1.28;

/**
 * Traffic velocity model based on time-of-day in East Africa Time (UTC+3)
 */
export function getTrafficVelocityKmPerHour(date = new Date()) {
  const utcHours = date.getUTCHours();
  const eatHours = (utcHours + 3) % 24;

  // Morning peak: 07:00 - 10:00 EAT
  // Evening peak: 16:30 - 19:30 EAT
  const isMorningPeak = eatHours >= 7 && eatHours < 10;
  const isEveningPeak = eatHours >= 16 && eatHours < 20;

  if (isMorningPeak || isEveningPeak) {
    return 16; // 16 km/h during heavy CBD/metro congestion
  }

  // Daytime normal: 10:00 - 16:00 EAT
  if (eatHours >= 10 && eatHours < 16) {
    return 24; // 24 km/h standard urban flow
  }

  // Night / Off-peak: 20:00 - 07:00 EAT
  return 32; // 32 km/h free flow
}

/**
 * Calculates travel duration and ETA minutes from remaining road distance.
 */
export function calculateEtaMinutes(remainingKm, velocityKmH = 24) {
  const safeDistance = Math.max(0, Number(remainingKm) || 0);
  const safeVelocity = Math.max(5, Number(velocityKmH) || 24);
  const roadDistance = safeDistance * URBAN_DETOUR_FACTOR;
  const travelMinutes = (roadDistance / safeVelocity) * 60;

  // Add 3-minute delivery buffer for parking, stairs, and door check
  const totalMinutes = Math.round(travelMinutes) + 3;
  return Math.max(1, totalMinutes);
}

/**
 * Compute progress ratio strictly from physical distance travelled.
 */
export function calculatePhysicalProgress(totalLegKm, remainingKm) {
  const total = Math.max(0.1, Number(totalLegKm) || 1);
  const remaining = Math.max(0, Number(remainingKm) || 0);
  const travelled = Math.max(0, total - remaining);
  const rawRatio = travelled / total;

  // Clamp between 0.0 and 0.95 (1.0 is reserved exclusively for delivered confirmation)
  return Math.max(0, Math.min(0.95, Math.round(rawRatio * 100) / 100));
}
