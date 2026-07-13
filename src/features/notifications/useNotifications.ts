import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';

export interface AppNotification {
  id: number | string;
  recipient_role: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export type NotificationVariant = 'default' | 'logistics';

const basePath = (variant: NotificationVariant) =>
  variant === 'logistics' ? '/notifications/logistics' : '/notifications';

/**
 * Notification feed for the bell / notification screen. Works for any logged-in
 * role on web or app (plain API, no push permission needed). Pass
 * variant="logistics" for the Mzigo partner (separate auth endpoint).
 */
export function useNotifications(variant: NotificationVariant = 'default', enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ['notifications', variant] as const;
  const base = basePath(variant);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AppNotification[]> => {
      const res = await apiClient.get(`${base}?limit=30`);
      return (res.data?.data ?? []) as AppNotification[];
    },
    enabled,
    refetchInterval: 45000,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: AppNotification['id']) => {
      await apiClient.patch(`${base}/${id}/read`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`${base}/read-all`);
    },
    onSuccess: () => {
      queryClient.setQueryData<AppNotification[]>(queryKey, (current = []) =>
        current.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    },
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['notifications', variant] });
  }, [queryClient, variant]);

  // On the native app, refetch the feed the moment a push arrives so the bell
  // badge updates instantly instead of waiting for the poll. No-op on web.
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { isNativeApp } = await import('@/lib/mobileApp');
        if (!isNativeApp()) return;
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const handle = await PushNotifications.addListener('pushNotificationReceived', () => {
          void queryClient.invalidateQueries({ queryKey: ['notifications', variant] });
        });
        if (cancelled) {
          void handle.remove();
          return;
        }
        removeListener = () => { void handle.remove(); };
      } catch {
        // Web build or plugin unavailable — the 45s poll handles refresh.
      }
    })();
    return () => {
      cancelled = true;
      if (removeListener) removeListener();
    };
  }, [queryClient, variant]);

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    refetch,
  };
}
