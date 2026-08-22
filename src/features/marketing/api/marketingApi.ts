/**
 * marketingApi.ts
 * All API calls for the marketing dashboard.
 * Uses UniversalHttpClient.
 */
import apiClient from '@/infrastructure/http/apiClient';

export interface MarketingOverview {
  totalUsers?: number;
  activeSellers?: number;
  activeCreators?: number;
  totalOrders?: number;
  totalGmvCents?: number;
  userGrowthMoM?: number;
  pendingSellers?: number;
  creatorEarningsTotalKsh?: number;
  [key: string]: any;
}

export const marketingApi = {
    getOverview: () =>
        apiClient.get<{ data: MarketingOverview }>('/admin/marketing/overview'),
    getGmvTrend: (months: number = 12) =>
        apiClient.get<{ data: any[] }>(`/admin/marketing/gmv-trend?months=${months}`),
    getUserGrowth: (months: number = 12) =>
        apiClient.get<{ data: any[] }>(`/admin/marketing/user-growth?months=${months}`),
    getProductMix: () =>
        apiClient.get<{ data: any }>('/admin/marketing/product-mix'),
    getOrderFunnel: () =>
        apiClient.get<{ data: any }>('/admin/marketing/order-funnel'),
    getGeography: () =>
        apiClient.get<{ data: any }>('/admin/marketing/geography'),
    getTopPerformers: () =>
        apiClient.get<{ data: any }>('/admin/marketing/top-performers'),
    getReferrals: () =>
        apiClient.get<{ data: any }>('/admin/marketing/referrals'),
    getActivity: (limit: number = 20) =>
        apiClient.get<{ data: any[] }>(`/admin/marketing/activity?limit=${limit}`)
};

export default marketingApi;
