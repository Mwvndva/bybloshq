import { useEffect, useRef, useState } from 'react';
import { fetchOrderLiveLocation } from '@/api/orders/liveLocation';
import type { OrderLiveLocation } from '@/types/api/order';

const POLL_INTERVAL_MS = 15_000;

/**
 * Poll the phase-scoped live-location endpoint while a delivery is in motion.
 * `enabled` should reflect whether the caller's own leg is currently trackable
 * (buyer ↔ out-for-delivery, seller ↔ active pickup) so we don't poll idly.
 */
export function useLiveDelivery(orderId: string, view: 'buyer' | 'seller', enabled: boolean) {
  const [data, setData] = useState<OrderLiveLocation | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      setData(null);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const result = await fetchOrderLiveLocation(orderId, view);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(null);
      }
    };

    void tick();
    timerRef.current = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [orderId, view, enabled]);

  return data;
}
