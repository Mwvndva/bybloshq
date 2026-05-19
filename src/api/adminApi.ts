import axios from 'axios';
import { getFreshCsrfToken } from '@/lib/apiClient';
import type {
  LogisticsDashboardResponse,
  LogisticsLegType,
  LogisticsSort,
  LogisticsStatusUpdate
} from '@/api/logisticsApi';

// Type for axios instance
type AxiosInstance = any; // Simplified type for Axios 1.12.2 compatibility

// Type definitions for error handling
interface ApiError {
  message: string;
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
  };
  config?: any;
  code?: string;
  request?: any;
}

// Default API configuration
// Include /api in the base URL since our routes are prefixed with /api
// Default API configuration
// Get the base URL from environment variables
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

console.log('Using VITE_API_URL:', API_BASE_URL);

// Helper function to determine product status based on stock
function getProductStatus(stock: number): 'In Stock' | 'Low Stock' | 'Out of Stock' {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= 10) return 'Low Stock';
  return 'In Stock';
}


// Create axios instance with default config
export const adminApiInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = adminApiInstance;

export type AdminLogisticsStatusFilter =
  | 'all'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'manual_review'
  | 'overdue';

export interface AdminLogisticsResponse extends LogisticsDashboardResponse {
  status: AdminLogisticsStatusFilter;
  summary: {
    failed: number;
    delayed: number;
    manualReview: number;
  };
}

// CSRF Token Cache for admin instance
let csrfTokenCache: string | null = null;

// Request Interceptor for CSRF
api.interceptors.request.use(
  async (config: any) => {
    // Attach CSRF token to non-GET requests
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      // If we don't have a token cached yet, fetch it
      if (!csrfTokenCache) {
        csrfTokenCache = await getFreshCsrfToken();
      }

      if (csrfTokenCache) {
        config.headers['X-CSRF-Token'] = csrfTokenCache;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear client-side auth state marker if used
      localStorage.removeItem('admin_authenticated');
      // Let global apiClient interceptor handle redirect with proper auth state checks
      console.log('Admin 401 - global interceptor will handle redirect');
    }
    return Promise.reject(error);
  }
);

// Admin API methods
export const adminApi = {
  // Admin login
  // Admin login
  async login(credentials: { email?: string; password?: string; pin?: string }) {
    try {
      console.log('Starting admin login...');
      // Specific payload based on what's provided, favouring email/password
      const payload = credentials.email && credentials.password
        ? { email: credentials.email, password: credentials.password }
        : { pin: credentials.pin };

      const response = await api.post('/admin/login', payload);
      console.log('Login response:', response.data);

      if (response.data?.status === 'success') {
        localStorage.setItem('admin_authenticated', 'true');
        // Store user info if available
        if (response.data.data?.user) {
          localStorage.setItem('admin_user', JSON.stringify(response.data.data.user));
        }

        // Refresh CSRF token for New Session
        csrfTokenCache = await getFreshCsrfToken();
      }

      return response.data;
    } catch (error) {
      const err = error as ApiError;
      console.error('Login error:', err.response?.data?.message || err.message);
      throw error;
    }
  },

  // Get current admin profile
  async getMe() {
    try {
      const { data } = await api.get('/admin/me');
      return data.data?.user;
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      throw error;
    }
  },

  // Auth Helper
  isAuthenticated() {
    return localStorage.getItem('admin_authenticated') === 'true';
  },

  logout() {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_user');
  },

  // Dashboard Analytics
  async getAnalytics() {
    try {
      console.log('Fetching dashboard analytics...');
      const { data } = await api.get('/admin/analytics');
      console.log('Dashboard analytics response:', data);

      return {
        ...data.data,
        userGrowth: data.data?.userGrowth || [],
        revenueTrends: data.data?.revenueTrends || [],
        salesTrends: data.data?.salesTrends || [],
        productStatus: data.data?.productStatus || [],
        geoDistribution: data.data?.geoDistribution || []
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        userGrowth: [],
        revenueTrends: [],
        salesTrends: [],
        productStatus: [],
        geoDistribution: []
      };
    }
  },

  // Basic Stats (Legacy Dashboard)
  async getDashboardStats() {
    try {
      const { data } = await api.get('/admin/stats');
      return data.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        totalBuyers: 0,
        totalClients: 0,
        totalCreators: 0,
        pendingCreatorRequests: 0,
        totalCreatorEarnings: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalWishlists: 0,
        topShops: []
      };
    }
  },

  // Buyers
  async getBuyers() {
    try {
      console.log('Fetching buyers from API...');
      const response = await api.get('/admin/buyers');
      console.log('Buyers API response:', response);

      // Handle different response formats
      let buyersData = [];
      if (response.data && Array.isArray(response.data.data)) {
        buyersData = response.data.data;
      } else if (Array.isArray(response.data)) {
        buyersData = response.data;
      } else {
        console.error('Unexpected API response format:', response);
        return [];
      }

      const buyers = buyersData.map((buyer: any) => ({
        id: String(buyer.id || `buyer-${globalThis.crypto.randomUUID()}`),
        name: String(buyer.name || buyer.full_name || 'Unnamed Buyer'),
        email: String(buyer.email || ''),
        phone: buyer.phone ? String(buyer.phone) : undefined,
        status: String(buyer.status || 'Active'),
        city: buyer.city || 'N/A',
        location: buyer.location || 'N/A',
        // Transform snake_case to camelCase for the frontend
        createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString(),
        user_id: buyer.user_id
      }));

      console.log(`Fetched ${buyers.length} buyers with location data`);
      return buyers;
    } catch (error) {
      console.error('Error fetching buyers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  async getBuyerById(id: string) {
    try {
      const response = await api.get(`/admin/buyers/${id}`);
      const buyer = response.data.data;
      if (!buyer) return null;
      return {
        ...buyer,
        id: String(buyer.id || ''),
        name: buyer.name || buyer.full_name || 'Unnamed Buyer',
        phone: buyer.phone || buyer.mobile_payment || '',
        createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching buyer details:', error);
      return null;
    }
  },

  // Sellers
  async getSellers() {
    try {
      console.log('Fetching sellers from API...');
      const response = await api.get('/admin/sellers');
      console.log('Sellers API response:', response);
      const sellersData = Array.isArray(response.data.data) ? response.data.data : [];
      return sellersData.map((seller: any) => ({
        ...seller,
        id: String(seller.id || ''),
        name: seller.name || seller.full_name || 'Unnamed Seller',
        phone: seller.phone || seller.whatsapp_number || '',
        createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
        user_id: seller.user_id
      }));
    } catch (error) {
      console.error('Error fetching sellers:', error);
      return [];
    }
  },

  async getCreators() {
    try {
      console.log('Fetching creators from API...');
      const response = await api.get('/admin/creators');
      const creatorsData = Array.isArray(response.data.data) ? response.data.data : [];
      return creatorsData.map((creator: any) => ({
        ...creator,
        id: String(creator.id || ''),
        user_id: creator.user_id ? String(creator.user_id) : '',
        name: creator.name || `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Unnamed Creator',
        email: String(creator.email || ''),
        mpesaNumber: String(creator.mpesa_number || ''),
        whatsappNumber: String(creator.whatsapp_number || ''),
        instagramLink: creator.instagram_link || '',
        tiktokLink: creator.tiktok_link || '',
        balance: Number(creator.balance || 0),
        totalSales: Number(creator.total_sales || 0),
        totalEarnings: Number(creator.total_earnings || 0),
        totalReferralEarnings: Number(creator.total_referral_earnings || 0),
        totalIncome: Number(creator.total_income || 0),
        linkedShops: Number(creator.linked_shops || 0),
        linkClicks: Number(creator.link_clicks || 0),
        pendingRequests: Number(creator.pending_requests || 0),
        status: String(creator.status || 'active'),
        createdAt: creator.created_at || creator.createdAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching creators:', error);
      return [];
    }
  },

  async getSellerById(id: string) {
    try {
      const response = await api.get(`/admin/sellers/${id}`);
      const seller = response.data.data;
      if (!seller) return null;
      return {
        ...seller,
        id: String(seller.id || ''),
        name: seller.name || seller.full_name || 'Unnamed Seller',
        phone: seller.phone || seller.whatsapp_number || '',
        createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
        recentOrders: (seller.recentOrders || []).map((o: any) => ({
          ...o,
          id: String(o.id || '')
        }))
      };
    } catch (error) {
      console.error('Error fetching seller details:', error);
      return null;
    }
  },

  // Get monthly metrics for sellers, products, and products sold
  async getMonthlyMetrics() {
    try {
      console.log('Fetching monthly metrics...');
      const response = await api.get('/admin/metrics/monthly');
      console.log('Monthly metrics response:', response.data);

      // Transform the data to match the expected format
      if (response.data && response.data.data) {
        return {
          ...response.data,
          data: response.data.data.map((item: any) => ({
            month: item.month,
            sellerCount: item.seller_count || 0,
            productCount: item.product_count || 0,
            buyerCount: item.buyer_count || 0
          }))
        };
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching monthly metrics:', error);
      throw error;
    }
  },

  // Update seller status
  updateSellerStatus(sellerId: string, data: { status: string }) {
    return api.patch(`/admin/sellers/${sellerId}/status`, data);
  },

  // Update buyer status
  updateBuyerStatus(buyerId: string, data: { status: string }) {
    return api.patch(`/admin/buyers/${buyerId}/status`, data);
  },

  // Clients
  async getClients() {
    try {
      console.log('Fetching clients from API...');
      const response = await api.get('/admin/clients');
      const clientsData = Array.isArray(response.data.data) ? response.data.data : [];
      return clientsData.map((client: any) => ({
        ...client,
        id: String(client.id || ''),
        createdAt: client.created_at || client.createdAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching clients:', error);
      return [];
    }
  },

  // Delete User (Block action)
  async deleteUser(userId: string) {
    try {
      const response = await api.delete(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },


  // Withdrawal requests
  async getWithdrawalRequests() {
    try {
      console.log('Fetching withdrawal requests from API...');
      const response = await api.get('/admin/withdrawal-requests');
      console.log('Withdrawal requests API response:', response);

      // Handle different response formats
      let withdrawalRequests = [];
      if (response.data && Array.isArray(response.data.data)) {
        withdrawalRequests = response.data.data;
      } else if (Array.isArray(response.data)) {
        withdrawalRequests = response.data;
      } else {
        console.error('Unexpected API response format:', response);
        return [];
      }

      const requests = withdrawalRequests.map((request: any) => ({
        id: String(request.id || `withdrawal-${globalThis.crypto.randomUUID()}`),
        amount: Number(request.amount || 0),
        mpesaNumber: String(request.mpesa_number || request.mpesaNumber || ''),
        mpesaName: String(request.mpesa_name || request.mpesaName || ''),
        status: String(request.status || 'pending'),
        sellerId: String(request.seller_id || request.sellerId || ''),
        sellerName: String(request.entityName || request.entity_name || request.seller_name || request.sellerName || request.mpesaName || request.mpesa_name || 'Seller'),
        sellerEmail: String(request.entityEmail || request.entity_email || request.seller_email || request.sellerEmail || ''),
        providerReference: request.provider_reference || request.providerReference || null,
        // Use camelCase for consistency
        createdAt: request.created_at || request.createdAt || new Date().toISOString(),
        processedAt: request.processed_at || request.processedAt || null,
        processedBy: request.processed_by || request.processedBy || null
      }));

      console.log(`Fetched ${requests.length} withdrawal requests`);
      return requests;
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  async updateWithdrawalRequestStatus(requestId: string, status: 'approved' | 'rejected') {
    return api.patch(`/admin/withdrawal-requests/${requestId}/status`, { status });
  },

  // Financial metrics
  async getFinancialMetrics() {
    try {
      console.log('Fetching financial metrics from API...');
      const response = await api.get('/admin/metrics/financial');
      console.log('Financial metrics API response:', response);
      return response.data.data || {
        totalSales: 0,
        totalOrders: 0,
        totalCommission: 0,
        totalRefunds: 0,
        totalRefundRequests: 0,
        pendingRefunds: 0,
        netRevenue: 0
      };
    } catch (error) {
      console.error('Error fetching financial metrics:', error);
      return {
        totalSales: 0,
        totalOrders: 0,
        totalCommission: 0,
        totalRefunds: 0,
        totalRefundRequests: 0,
        pendingRefunds: 0,
        netRevenue: 0
      };
    }
  },

  async getMonthlyFinancialData() {
    try {
      console.log('Fetching monthly financial data from API...');
      const response = await api.get('/admin/metrics/financial/monthly');
      console.log('Monthly financial data API response:', response);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching monthly financial data:', error);
      return [];
    }
  },

  async getPaymentProviderBalances() {
    try {
      const response = await api.get('/admin/payment-provider/balances');
      return response.data.data || null;
    } catch (error) {
      console.error('Error fetching payment provider balance/status:', error);
      return {
        payin: { error: 'Unavailable' },
        payout: { error: 'Unavailable' },
        timestamp: new Date().toISOString()
      };
    }
  },

  async getLogisticsRequests({
    status = 'all',
    sort = 'priority',
  }: {
    status?: AdminLogisticsStatusFilter;
    sort?: LogisticsSort;
  } = {}) {
    const response = await api.get('/admin/logistics/requests', {
      params: { status, sort },
    });
    return response.data?.data as AdminLogisticsResponse;
  },

  async updateLogisticsLegStatus({
    requestId,
    legType,
    status,
    reason,
  }: {
    requestId: number;
    legType: LogisticsLegType;
    status: LogisticsStatusUpdate;
    reason?: string;
  }) {
    const response = await api.patch(`/admin/logistics/requests/${requestId}/legs/${legType}/status`, {
      status,
      reason,
    });
    return response.data?.data;
  },

  async resolveLogisticsDispute({
    requestId,
    resolution,
    note,
  }: {
    requestId: number;
    resolution: 'manual_review' | 'continue_delivery' | 'mark_failed' | 'resolved';
    note?: string;
  }) {
    const response = await api.post(`/admin/logistics/requests/${requestId}/disputes/resolve`, {
      resolution,
      note,
    });
    return response.data?.data;
  }
};

export default adminApi;
