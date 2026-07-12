import { useState, useEffect } from 'react';
import { useBuyerOrdersQuery } from '@/hooks/buyer/queries/useBuyerOrdersQuery';

export function useBuyerOrdersNotification(enabled: boolean) {
  const ordersQuery = useBuyerOrdersQuery(enabled);
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);
  const [lastViewedOrdersTime, setLastViewedOrdersTime] = useState<string | null>(
    localStorage.getItem('buyer_last_viewed_orders')
  );

  // Check for order updates
  useEffect(() => {
    if (ordersQuery.data && ordersQuery.data.length > 0) {
      // Get the most recent order update time (could be createdAt or updatedAt)
      const latestUpdateTime = Math.max(
        ...ordersQuery.data.map(order => {
          const created = new Date(order.createdAt).getTime();
          const updated = order.updatedAt ? new Date(order.updatedAt).getTime() : created;
          return Math.max(created, updated);
        })
      );

      const lastViewed = lastViewedOrdersTime
        ? new Date(lastViewedOrdersTime).getTime()
        : 0;

      setHasUnreadOrders(latestUpdateTime > lastViewed);
    } else {
      setHasUnreadOrders(false);
    }
  }, [ordersQuery.data, lastViewedOrdersTime]);

  const markOrdersViewed = () => {
    const now = new Date().toISOString();
    setLastViewedOrdersTime(now);
    localStorage.setItem('buyer_last_viewed_orders', now);
    setHasUnreadOrders(false);
  };

  return { hasUnreadOrders, markOrdersViewed };
}
