import { useEffect, useRef, useState } from 'react';
import { postLogisticsLocation } from '@/api/logistics';

const MIN_SEND_INTERVAL_MS = 12_000;

interface BroadcastState {
  supported: boolean;
  active: boolean;
  error: string | null;
  lastSentAt: number | null;
}

/**
 * While enabled, watch the courier's device location (web geolocation) and push
 * each fresh position to every logistics request that is currently in motion.
 * Throttled so we send at most once per ~12s regardless of how chatty the GPS is.
 */
export function useCourierBroadcast(requestIds: number[], enabled: boolean): BroadcastState {
  const [state, setState] = useState<BroadcastState>({
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    active: false,
    error: null,
    lastSentAt: null,
  });

  // Keep the latest id set in a ref so the watch always targets current requests
  // without tearing down and restarting on every list change.
  const idsRef = useRef<number[]>(requestIds);
  idsRef.current = requestIds;
  const lastSentRef = useRef(0);

  const hasTargets = requestIds.length > 0;

  useEffect(() => {
    if (!enabled || !hasTargets) {
      setState((prev) => ({ ...prev, active: false }));
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, supported: false, active: false, error: 'Location is not available on this device.' }));
      return;
    }

    setState((prev) => ({ ...prev, error: null }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentRef.current < MIN_SEND_INTERVAL_MS) return;
        lastSentRef.current = now;

        const { latitude, longitude, accuracy, heading, speed } = position.coords;
        const payload = { lat: latitude, lng: longitude, accuracy, heading, speed };

        idsRef.current.forEach((requestId) => {
          postLogisticsLocation(requestId, payload).catch(() => {
            // A single failed ping is non-fatal; the next tick retries.
          });
        });

        setState((prev) => ({ ...prev, active: true, error: null, lastSentAt: now }));
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          active: false,
          error: error.code === error.PERMISSION_DENIED
            ? 'Location permission is off. Turn it on to share live tracking.'
            : 'Could not read your location.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // Restart only when sharing toggles or we cross the empty/non-empty boundary.
  }, [enabled, hasTargets]);

  return state;
}
