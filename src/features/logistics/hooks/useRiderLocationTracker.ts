import { useEffect, useRef, useState } from 'react';
import { postRiderLocation } from '../api/eta';
import logger from '@/shared/utils/logger';

interface UseRiderLocationTrackerOptions {
  legId: string | number | null | undefined;
  isActive: boolean;
  intervalMs?: number;
}

export function useRiderLocationTracker({
  legId,
  isActive,
  intervalMs = 15_000,
}: UseRiderLocationTrackerOptions) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPostTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const stopTracking = () => {
      setIsBroadcasting(false);

      if (watchIdRef.current !== null) {
        if ('geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!isActive || !legId) {
      stopTracking();
      return;
    }

    const sendLocationUpdate = async (latitude: number, longitude: number) => {
      const now = Date.now();
      lastCoordsRef.current = { lat: latitude, lng: longitude };

      // Throttle posts to avoid spamming the backend
      if (now - lastPostTimeRef.current < intervalMs && lastPostTimeRef.current > 0) {
        return;
      }

      try {
        lastPostTimeRef.current = now;
        await postRiderLocation(String(legId), {
          latitude,
          longitude,
          timestamp: now,
        });
        if (!isCancelled) {
          setLastSentAt(new Date(now));
          setError(null);
        }
      } catch (postErr: any) {
        logger.warn('[RiderTracker] Failed to post rider location:', postErr.message);
      }
    };

    const startTracking = () => {
      setIsBroadcasting(true);
      setError(null);

      if (!('geolocation' in navigator)) {
        setError('Geolocation is not supported by this device.');
        return;
      }

      const handlePosition = (pos: GeolocationPosition) => {
        sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
      };

      const handleError = (err: GeolocationPositionError) => {
        logger.warn('[RiderTracker] Geolocation error:', err.message);
        if (!isCancelled) setError(err.message);
      };

      const webWatchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      });

      watchIdRef.current = webWatchId;

      // Ensure recurring heartbeat post
      timerRef.current = setInterval(() => {
        if (lastCoordsRef.current) {
          sendLocationUpdate(lastCoordsRef.current.lat, lastCoordsRef.current.lng);
        }
      }, intervalMs);
    };

    startTracking();

    return () => {
      isCancelled = true;
      stopTracking();
    };
  }, [isActive, legId, intervalMs]);

  return { isBroadcasting, lastSentAt, error };
}
