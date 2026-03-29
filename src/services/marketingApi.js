/**
 * marketingApi.js
 * All API calls for the marketing dashboard.
 * Token is stored in sessionStorage (clears when browser tab closes).
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://bybloshq.space/api'

const marketingClient = axios.create({ baseURL: BASE_URL })

// Attach token to every request
marketingClient.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('marketing_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// On 401, clear token and redirect to login
marketingClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            sessionStorage.removeItem('marketing_token')
            sessionStorage.removeItem('marketing_user')
            window.location.href = '/marketing/login'
        }
        return Promise.reject(err)
    }
)

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
