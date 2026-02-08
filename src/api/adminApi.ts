import axios from 'axios';
import { EventTicketsResponse } from '@/types/ticket';

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

// Helper function to determine event status
function getEventStatus(
  startDate?: string,
  endDate?: string,
  status?: string
): 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled' {
  if (status) {
    // If status is explicitly provided and valid, use it
    const validStatuses = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'] as const;
    if (validStatuses.includes(status as any)) {
      return status as any;
    }
  }

  // Otherwise determine status based on dates
  if (!startDate) return 'Upcoming';

  const now = new Date();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  if (now < start) return 'Upcoming';
  if (end && now > end) return 'Completed';
  return 'Ongoing';
}

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      }

      return response.data;
    } catch (error) {
      const err = error as ApiError;
      console.error('Login error:', err.response?.data?.message || err.message);
      throw error;
    }
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
        productStatus: data.data?.productStatus || [],
        geoDistribution: data.data?.geoDistribution || []
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        userGrowth: [],
        revenueTrends: [],
        productStatus: [],
        geoDistribution: []
      };
    }
  },

  // Events
  async getEvents() {
    try {
      console.log('Fetching events from API...');
      const response = await api.get('/admin/events');
      console.log('Events API response:', response);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  },

  async getMonthlyEvents() {
    try {
      console.log('Fetching monthly events from API...');
      const response = await api.get('/admin/events/monthly');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching monthly events:', error);
      return [];
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
        totalSellers: 0,
        totalBuyers: 0,
        totalEvents: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalWishlists: 0
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
        id: String(buyer.id || `buyer-${Math.random().toString(36).substr(2, 9)}`),
        name: String(buyer.name || buyer.full_name || 'Unnamed Buyer'),
        email: String(buyer.email || ''),
        phone: buyer.phone ? String(buyer.phone) : undefined,
        status: String(buyer.status || 'Active'),
        city: buyer.city || 'N/A',
        location: buyer.location || 'N/A',
        // Transform snake_case to camelCase for the frontend
        createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString()
      }));

      console.log(`Fetched ${buyers.length} buyers with location data`);
      return buyers;
    } catch (error) {
      console.error('Error fetching buyers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Sellers
  async getSellers() {
    try {
      console.log('Fetching sellers from API...');
      const response = await api.get('/admin/sellers');
      console.log('Sellers API response:', response);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching sellers:', error);
      return [];
    }
  },

  async getSellerById(id: string) {
    try {
      const response = await api.get(`/admin/sellers/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching seller details:', error);
      return null;
    }
  },

  // Organizers
  async getOrganizers() {
    try {
      console.log('Fetching organizers from API...');
      const response = await api.get('/admin/organizers');
      console.log('Organizers API response:', response);

      // Handle different response formats
      let organizersData = [];
      if (response.data && Array.isArray(response.data.data)) {
        organizersData = response.data.data;
      } else if (Array.isArray(response.data)) {
        organizersData = response.data;
      } else {
        console.error('Unexpected API response format:', response);
        return [];
      }

      const organizers = organizersData.map((organizer: any) => ({
        id: String(organizer.id || `org-${Math.random().toString(36).substr(2, 9)}`),
        name: String(organizer.name || organizer.full_name || 'Unnamed Organizer'),
        email: String(organizer.email || ''),
        phone: organizer.phone ? String(organizer.phone) : undefined,
        status: String(organizer.status || 'Active'),
        // Transform snake_case to camelCase for the frontend
        createdAt: organizer.created_at || organizer.createdAt || new Date().toISOString()
      }));

      console.log(`Fetched ${organizers.length} organizers`);
      return organizers;
    } catch (error) {
      console.error('Error fetching organizers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Get ticket types for an event
  async getEventTicketTypes(eventId: string | number) {
    try {
      const response = await api.get(`/events/public/${eventId}/ticket-types`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event ticket types:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Get ticket buyers for an event with detailed ticket type information
  async getEventTicketBuyers(eventId: string | number): Promise<EventTicketsResponse> {
    try {
      console.log(`Fetching tickets for event ${eventId} from: ${api.defaults.baseURL}/admin/events/${eventId}/tickets`);
      const response = await api.get(`/admin/events/${eventId}/tickets`);
      console.log('API Response:', response.data);
      const tickets = response.data?.data?.tickets || [];

      // Map the response to match the frontend's expected format
      return {
        data: {
          event: response.data?.data?.event || null,
          tickets: tickets.map((ticket: any) => ({
            id: ticket.id,
            ticketNumber: ticket.ticket_number,
            customerName: ticket.customer_name,
            customerEmail: ticket.customer_email,
            price: parseFloat(ticket.price || 0),
            status: ticket.status,
            createdAt: ticket.created_at,
            scanned: ticket.scanned,
            scannedAt: ticket.scanned_at,
            ticketType: ticket.ticket_type ? {
              id: ticket.ticket_type.id,
              name: ticket.ticket_type.name,
              displayName: ticket.ticket_type.name, // Using name as display name if not provided
              description: ticket.ticket_type.description || '',
              price: parseFloat(ticket.ticket_type.price || 0),
              quantityAvailable: parseInt(ticket.ticket_type.quantity_available || 0, 10),
              salesStart: ticket.ticket_type.sales_start,
              salesEnd: ticket.ticket_type.sales_end
            } : {
              // Fallback for tickets without type information
              id: `temp-${Math.random().toString(36).substr(2, 9)}`,
              name: ticket.ticket_type_name || 'General Admission',
              displayName: ticket.ticket_type_name || 'General Admission',
              description: '',
              price: parseFloat(ticket.price || 0),
              quantityAvailable: 0,
              salesStart: null,
              salesEnd: null
            }
          }))
        }
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      };
      console.error('Error fetching event ticket buyers:', errorDetails);

      // Log the error to the server if needed
      try {
        await api.post('/error-log', {
          type: 'ticket_fetch_error',
          error: errorDetails,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }

      // Return empty data that matches the EventTicketsResponse type
      return {
        data: {
          event: null,
          tickets: []
        }
      };
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

  // Mark event as paid (withdrawal processed)
  markEventAsPaid(eventId: string, withdrawalMethod?: string, withdrawalDetails?: any) {
    return api.patch(`/admin/events/${eventId}/mark-paid`, { withdrawalMethod, ...withdrawalDetails });
  },

  // Update organizer status
  updateOrganizerStatus(organizerId: string, data: { status: string }) {
    return api.patch(`/admin/organizers/${organizerId}/status`, data);
  },

  // Update seller status
  updateSellerStatus(sellerId: string, data: { status: string }) {
    return api.patch(`/admin/sellers/${sellerId}/status`, data);
  },

  // Update buyer status
  updateBuyerStatus(buyerId: string, data: { status: string }) {
    return api.patch(`/admin/buyers/${buyerId}/status`, data);
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
        id: String(request.id || `withdrawal-${Math.random().toString(36).substr(2, 9)}`),
        amount: Number(request.amount || 0),
        mpesaNumber: String(request.mpesa_number || request.mpesaNumber || ''),
        mpesaName: String(request.mpesa_name || request.mpesaName || ''),
        status: String(request.status || 'pending'),
        sellerId: String(request.seller_id || request.sellerId || ''),
        sellerName: String(request.seller_name || request.sellerName || 'Unknown Seller'),
        sellerEmail: String(request.seller_email || request.sellerEmail || ''),
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
  }
};

export default adminApi;
