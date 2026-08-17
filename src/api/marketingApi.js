/**
 * marketingApi.js
 * All API calls for the marketing dashboard.
 * Uses UniversalHttpClient with WebSessionStorageAdapter.
 */
import { UniversalHttpClient } from '@/lib/http/UniversalHttpClient';
import { WebLocalStorageAdapter } from '@/lib/auth/adapters';
import { WebAuthStrategy } from '@/lib/auth/WebAuthStrategy';

const marketingStorage = new WebLocalStorageAdapter();
const marketingAuthStrategy = new WebAuthStrategy(marketingStorage);

const marketingClient = new UniversalHttpClient({
  storageAdapter: marketingStorage,
  authStrategy: marketingAuthStrategy,
  defaultRole: 'marketing'
});

export const marketingApi = {
    login: async (email, password) => {
        return marketingClient.post('/admin/marketing/login', { email, password });
    },
    getOverview: () =>
        marketingClient.get('/admin/marketing/overview'),
    getGmvTrend: (months = 12) =>
        marketingClient.get(`/admin/marketing/gmv-trend?months=${months}`),
    getUserGrowth: (months = 12) =>
        marketingClient.get(`/admin/marketing/user-growth?months=${months}`),
    getProductMix: () =>
        marketingClient.get('/admin/marketing/product-mix'),
    getOrderFunnel: () =>
        marketingClient.get('/admin/marketing/order-funnel'),
    getGeography: () =>
        marketingClient.get('/admin/marketing/geography'),
    getTopPerformers: () =>
        marketingClient.get('/admin/marketing/top-performers'),
    getReferrals: () =>
        marketingClient.get('/admin/marketing/referrals'),
    getActivity: (limit = 20) =>
        marketingClient.get(`/admin/marketing/activity?limit=${limit}`)
};
