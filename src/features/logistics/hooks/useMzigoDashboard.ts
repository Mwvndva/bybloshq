import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { logisticsQueryKeys } from '@/features/logistics/api/queryKeys';
import {
  clearLogisticsSession,
  fetchLogisticsMe,
  fetchLogisticsRequests,
  getStoredLogisticsPartner,
  isLogisticsSessionActive,
  LogisticsLegType,
  LogisticsSort,
  LogisticsStatusUpdate,
  updateLogisticsLegStatus,
} from '@/features/logistics/api';
import { toast } from 'sonner';
import { useGlobalAuth } from '@/features/auth/hooks/useGlobalAuth';

export function useMzigoDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: globalUser, logout: authLogout } = useGlobalAuth();
  const [sort, setSort] = useState<LogisticsSort>('priority');
  const [now, setNow] = useState(Date.now());
  const [updatingStatusKey, setUpdatingStatusKey] = useState<string | null>(null);

  useEffect(() => {
    const isLogistics = globalUser?.role === 'logistics' && globalUser.isAuthenticated;
    if (!isLogistics && !isLogisticsSessionActive()) {
      navigate('/mzigo/login', { replace: true });
    }
  }, [navigate, globalUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const partnerQuery = useQuery({
    queryKey: logisticsQueryKeys.me(),
    queryFn: fetchLogisticsMe,
    enabled: Boolean(globalUser?.isAuthenticated),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const requestsQuery = useQuery({
    queryKey: logisticsQueryKeys.requests(sort),
    queryFn: () => fetchLogisticsRequests(sort),
    enabled: Boolean(globalUser?.isAuthenticated),
    refetchInterval: 60_000,
    staleTime: 20_000,
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: updateLogisticsLegStatus,
    onSuccess: (result) => {
      toast.success(result.updated ? 'Status updated' : 'Status already up to date');
      queryClient.invalidateQueries({ queryKey: logisticsQueryKeys.all });
    },
    onError: (error: unknown) => {
      const errObj = error as Record<string, unknown>;
      const response = errObj.response as Record<string, unknown> | undefined;
      const data = response?.data as Record<string, unknown> | undefined;
      toast.error('Status update failed', {
        description: String(data?.message || errObj.message || 'Mzigo status was not updated.'),
      });
    },
    onSettled: () => {
      setUpdatingStatusKey(null);
    },
  });

  useEffect(() => {
    if (partnerQuery.isError || requestsQuery.isError) {
      const partnerErr = partnerQuery.error as unknown as Record<string, unknown> | null;
      const requestsErr = requestsQuery.error as unknown as Record<string, unknown> | null;
      const status = (partnerErr?.response as Record<string, unknown>)?.status || (requestsErr?.response as Record<string, unknown>)?.status;
      if (status === 401 || status === 403) {
        handleLogout();
      }
    }
  }, [navigate, partnerQuery.error, partnerQuery.isError, requestsQuery.error, requestsQuery.isError]);

  const partner = partnerQuery.data || (globalUser?.profile as any) || getStoredLogisticsPartner();
  const dashboard = requestsQuery.data;

  const grouped = useMemo(() => ({
    pickupDelivery: dashboard?.groups?.pickupDelivery || [],
    deliveryOnly: dashboard?.groups?.deliveryOnly || [],
    pickupOnly: dashboard?.groups?.pickupOnly || [],
    hubDropoff: dashboard?.groups?.hubDropoff || [],
    completed: dashboard?.groups?.completed || [],
  }), [dashboard]);

  const activeCount = grouped.pickupDelivery.length
    + grouped.deliveryOnly.length
    + grouped.pickupOnly.length
    + grouped.hubDropoff.length;
  const overdueCount = [
    ...grouped.pickupDelivery,
    ...grouped.deliveryOnly,
    ...grouped.pickupOnly,
    ...grouped.hubDropoff,
  ].filter((request) => request.isOverdue).length;

  const handleLogout = async () => {
    await authLogout();
    await clearLogisticsSession();
    navigate('/mzigo/login', { replace: true });
  };


  const handleStatusUpdate = (
    requestId: number,
    legType: LogisticsLegType,
    status: LogisticsStatusUpdate
  ) => {
    setUpdatingStatusKey(`${requestId}:${legType}:${status}`);
    statusMutation.mutate({ requestId, legType, status });
  };


  return {
    sort,
    setSort,
    now,
    updatingStatusKey,
    partner,
    dashboard,
    grouped,
    activeCount,
    overdueCount,
    handleLogout,
    handleStatusUpdate,
    requestsQuery,
  };
}
