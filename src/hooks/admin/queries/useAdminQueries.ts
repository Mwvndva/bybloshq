import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { adminQueryKeys } from '@/api/queryKeys';

export function useAdminAnalyticsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.analytics(),
    queryFn: adminApi.getAnalytics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminSellersQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.sellers(),
    queryFn: adminApi.getSellers,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminCreatorsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.creators(),
    queryFn: adminApi.getCreators,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminBuyersQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.buyers(),
    queryFn: adminApi.getBuyers,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminWithdrawalsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.withdrawals(),
    queryFn: adminApi.getWithdrawalRequests,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminMonthlyMetricsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.monthlyMetrics(),
    queryFn: adminApi.getMonthlyMetrics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminFinancialsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.financials(),
    queryFn: adminApi.getFinancialMetrics,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminMonthlyFinancialDataQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.monthlyFinancialData(),
    queryFn: adminApi.getMonthlyFinancialData,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminDashboardStatsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.dashboardStats(),
    queryFn: adminApi.getDashboardStats,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminClientsQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.clients(),
    queryFn: adminApi.getClients,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAdminBalancesQuery(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.balances(),
    queryFn: adminApi.getPaymentProviderBalances,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}


