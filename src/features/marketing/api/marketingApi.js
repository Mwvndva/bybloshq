/**
 * marketingApi.js
 * All API calls for the marketing dashboard.
 * Uses UniversalHttpClient with WebSessionStorageAdapter.
 */
import apiClient from '@/infrastructure/http/apiClient';

export const marketingApi = {
    getOverview: () =>
        apiClient.get('/admin/marketing/overview'),
    getGmvTrend: (months = 12) =>
        apiClient.get(`/admin/marketing/gmv-trend?months=${months}`),
    getUserGrowth: (months = 12) =>
        apiClient.get(`/admin/marketing/user-growth?months=${months}`),
    getProductMix: () =>
        apiClient.get('/admin/marketing/product-mix'),
    getOrderFunnel: () =>
        apiClient.get('/admin/marketing/order-funnel'),
    getGeography: () =>
        apiClient.get('/admin/marketing/geography'),
    getTopPerformers: () =>
        apiClient.get('/admin/marketing/top-performers'),
    getReferrals: () =>
        apiClient.get('/admin/marketing/referrals'),
    getActivity: (limit = 20) =>
        apiClient.get(`/admin/marketing/activity?limit=${limit}`)
};
