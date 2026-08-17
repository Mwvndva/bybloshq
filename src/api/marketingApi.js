/**
 * marketingApi.js
 * All API calls for the marketing dashboard.
 * Uses UniversalHttpClient with WebSessionStorageAdapter.
 */
import { UniversalHttpClient } from '@/lib/http/UniversalHttpClient';
import { WebSessionStorageAdapter } from '@/lib/auth/adapters';

const marketingStorage = new WebSessionStorageAdapter();

class MarketingAuthStrategy {
  platform = 'web';

  constructor(storageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  async getAuthHeaders() {
    let token = await this.storageAdapter.getItem('marketingToken');
    if (!token) {
      token = await this.storageAdapter.getItem('marketing_token');
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getCsrfHeader() {
    return {};
  }

  async handleUnauthorized() {
    return false;
  }

  async clearSession() {
    await this.storageAdapter.removeItem('marketingToken');
    await this.storageAdapter.removeItem('marketing_token');
    await this.storageAdapter.removeItem('marketing_user');
    await this.storageAdapter.removeItem('marketingSessionActive');
  }
}

const marketingAuthStrategy = new MarketingAuthStrategy(marketingStorage);

const marketingClient = new UniversalHttpClient({
  storageAdapter: marketingStorage,
  authStrategy: marketingAuthStrategy,
  defaultRole: 'marketing'
});

export const marketingApi = {
    login: async (email, password) => {
        const response = await marketingClient.post('/admin/marketing/login', { email, password });
        const authData = response.data?.data;
        if (authData?.token) {
            await marketingStorage.setItem('marketingToken', authData.token);
            await marketingStorage.setItem('marketing_token', authData.token);
        }
        if (authData?.user) {
            await marketingStorage.setItem('marketing_user', JSON.stringify(authData.user));
            await marketingStorage.setItem('marketingSessionActive', 'true');
        }
        return response;
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
