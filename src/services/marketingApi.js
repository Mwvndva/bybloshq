/**
 * marketingApi.js
 * All API calls for the marketing dashboard.
 * Token is stored in sessionStorage (clears when browser tab closes).
 */
import axios from 'axios'
import { getFreshCsrfToken, getCachedCsrfToken } from '@/lib/apiClient'

const BASE_URL = '/api'

const marketingClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true // Ensure cookies are sent
})

// Attach token to every request
marketingClient.interceptors.request.use(async (config) => {
    // 1. Attach Auth Token
    const token = sessionStorage.getItem('marketing_token')
    if (token) config.headers.Authorization = `Bearer ${token}`

    // 2. Attach CSRF token to non-GET requests
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
        let csrfToken = getCachedCsrfToken();
        if (!csrfToken) {
            csrfToken = await getFreshCsrfToken();
        }
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return config
})

marketingClient.interceptors.response.use(
    (res) => res,
    async (err) => {
        const config = err.config;
        const status = err.response?.status;
        const message = err.response?.data?.message || '';

        // Handle CSRF Mismatch
        if (status === 403 && message.includes('CSRF mismatch') && !config._retry) {
            config._retry = true;
            console.warn('[CSRF-Marketing] Mismatch detected. Refreshing token and retrying...');

            const newToken = await getFreshCsrfToken();
            if (newToken) {
                config.headers['X-CSRF-Token'] = newToken;
                return marketingClient(config);
            }
        }

        // Only redirect to login if NOT already trying to login/logout
        const isAuthRequest = config?.url?.includes('/admin/marketing/login');

        if (status === 401 && !isAuthRequest) {
            sessionStorage.removeItem('marketing_token');
            sessionStorage.removeItem('marketing_user');
            globalThis.location.href = '/admin/marketing/login';
        }
        throw err;
    }
);

export const marketingApi = {
    login: (email, password) =>
        marketingClient.post('/admin/marketing/login', { email, password }),
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
}
