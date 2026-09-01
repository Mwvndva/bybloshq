import { useEffect, useRef, useState } from 'react';
import { postRiderLocation } from '../api/eta';
import logger from '@/shared/utils/logger';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

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
  const watchIdRef = useRef<number | string | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPostTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const stopTracking = async () => {
      setIsBroadcasting(false);

      if (watchIdRef.current !== null) {
        if (isNativeApp()) {
          try {
            const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
            await BackgroundGeolocation.removeWatcher({ id: String(watchIdRef.current) });
          } catch (e: any) {
            logger.warn('[RiderTracker] Failed to remove native background watcher:', e?.message || e);
          }
        } else if ('geolocation' in navigator && typeof watchIdRef.current === 'number') {
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

    const startTracking = async () => {
      setIsBroadcasting(true);
      setError(null);

      if (isNativeApp()) {
        try {
          const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');
          const watcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Transmitting delivery location',
              backgroundTitle: 'Mzigo Courier Active',
              requestPermissions: true,
              stale: false,
              distanceFilter: 10,
            },
            (location, err) => {
              if (err) {
                logger.warn('[RiderTracker] Native background geolocation error:', err.message);
                if (!isCancelled) setError(err.message);
                return;
              }
              if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
                sendLocationUpdate(location.latitude, location.longitude);
              }
            }
          );

          if (isCancelled) {
            await BackgroundGeolocation.removeWatcher({ id: watcherId });
          } else {
            watchIdRef.current = watcherId;
          }
          return;
        } catch (nativeErr: any) {
          logger.warn('[RiderTracker] Failed to initialize native background geolocation, falling back to web:', nativeErr?.message);
        }
      }

      // Web fallback
      if (!('geolocation' in navigator)) {
        setError('Geolocation is not supported by this device.');
        return;
      }

      const handlePosition = (pos: GeolocationPosition) => {
        sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
      };

      const handleError = (err: GeolocationPositionError) => {
        logger.warn('[RiderTracker] Web geolocation error:', err.message);
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
