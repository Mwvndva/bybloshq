import axios from 'axios';
import { EventTicketsResponse } from '@/types/ticket';

// Default API configuration
// Include /api in the base URL since our routes are prefixed with /api
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
console.log('Using API base URL:', API_BASE_URL);

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
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 Unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear the token and redirect to login
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_authenticated');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Admin API methods
export const adminApi = {
  // Admin login
  async login(pin: string) {
    try {
      console.log('Starting admin login with PIN:', pin);
      const response = await api.post('/admin/login', { pin });
      console.log('Login response:', response.data);
      
      // Store the token in localStorage if it exists in the response
      if (response.data?.data?.token) {
        localStorage.setItem('admin_token', response.data.data.token);
        localStorage.setItem('admin_authenticated', 'true');
        console.log('Token stored in localStorage');
      } else {
        console.warn('No token found in login response');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_authenticated');
  },

  isAuthenticated(): boolean {
    const token = localStorage.getItem('admin_token');
    console.log('Checking authentication, token exists:', !!token);
    return !!token;
  },

  // Sellers
  async getSellers() {
    try {
      console.log('Fetching sellers from API...');
      const response = await api.get('/admin/sellers');
      console.log('Sellers API response:', response);
      
      // Handle different response formats
      let sellersData = [];
      if (response.data && Array.isArray(response.data.data)) {
        sellersData = response.data.data;
      } else if (Array.isArray(response.data)) {
        sellersData = response.data;
      } else {
        console.error('Unexpected API response format:', response);
        return [];
      }
      
      const sellers = sellersData.map((seller: any) => ({
        id: String(seller.id || `seller-${Math.random().toString(36).substr(2, 9)}`),
        name: String(seller.name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || 'Unnamed Seller'),
        email: String(seller.email || ''),
        phone: seller.phone ? String(seller.phone) : undefined,
        status: String(seller.status || 'Active'),
        // Use camelCase for consistency
        createdAt: seller.created_at || seller.createdAt || new Date().toISOString()
      }));
      
      console.log(`Fetched ${sellers.length} sellers`);
      return sellers;
    } catch (error) {
      console.error('Error fetching sellers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Events
  async getEvents() {
    try {
      console.log('Fetching events from API...');
      const response = await api.get('/admin/events');
      console.log('Raw API response:', response);
      
      // Handle different response formats
      let eventsData = [];
      if (response.data && Array.isArray(response.data.data)) {
        eventsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        eventsData = response.data;
      } else {
        console.error('Unexpected API response format:', response);
        return [];
      }
      
      const events = eventsData.map((event: any) => ({
        id: String(event.id || `event-${Math.random().toString(36).substr(2, 9)}`),
        title: String(event.title || 'Untitled Event'),
        date: event.start_date || event.date || new Date().toISOString(),
        end_date: event.end_date || undefined,
        venue: String(event.venue || event.location || 'Venue not specified'),
        location: String(event.location || event.venue || 'Location not specified'),
        status: getEventStatus(event.start_date, event.end_date, event.status),
        organizer_name: String(event.organizer?.name || event.organizer_name || 'Unknown Organizer'),
        attendees_count: Number(event.attendees_count || event.attendeesCount || 0),
        revenue: Number(event.revenue || 0),
        // Use camelCase for consistency
        createdAt: event.created_at || event.createdAt || new Date().toISOString()
      }));
      
      // Sort events by date (newest first)
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log(`Fetched ${events.length} events`);
      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Products
  async getProducts() {
    try {
      console.log('Fetching products from API...');
      const { data } = await api.get('/admin/products');
      console.log('Products API response:', data);
      
      // Handle different response formats
      let productsData = [];
      if (data && Array.isArray(data.data)) {
        productsData = data.data;
      } else if (Array.isArray(data)) {
        productsData = data;
      } else {
        console.error('Unexpected API response format:', data);
        return [];
      }
      
      const products = productsData.map((product: any) => ({
        id: String(product.id || `product-${Math.random().toString(36).substr(2, 9)}`),
        name: String(product.name || 'Unnamed Product'),
        price: Number(product.price || 0),
        status: getProductStatus(Number(product.stock || 0)),
        stock: Number(product.stock || 0),
        seller_name: String(product.seller?.name || product.seller_name || 'Unknown Seller'),
        // Use camelCase for consistency
        createdAt: product.created_at || product.createdAt || new Date().toISOString(),
        // Include additional fields that might be needed
        image: product.image_url || product.image || '',
        description: product.description || ''
      }));
      
      console.log(`Fetched ${products.length} products`);
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  // Get monthly event counts
  async getMonthlyEvents() {
    try {
      console.log('Fetching monthly events...');
      const { data } = await api.get('/admin/events/monthly');
      console.log('Monthly events response:', data);
      
      // Transform the data to match the expected format
      const monthlyEvents = Array.isArray(data.data) 
        ? data.data.map((item: any) => ({
            month: item.month || '',
            count: item.count || 0,
            revenue: item.revenue || 0,
            // Include any additional fields
            ...item
          }))
        : [];
      
      console.log('Transformed monthly events:', monthlyEvents);
      return monthlyEvents;
    } catch (error) {
      console.error('Error fetching monthly events:', error);
      // Return an empty array with the expected structure
      return [];
    }
  },

  // Dashboard Analytics
  async getAnalytics() {
    try {
      console.log('Fetching dashboard analytics...');
      const { data } = await api.get('/admin/dashboard');
      console.log('Dashboard analytics response:', data);
      
      // Transform the response to match the expected frontend format
      const analytics = {
        totalRevenue: data.data?.total_revenue || 0,
        totalEvents: data.data?.total_events || 0,
        totalOrganizers: data.data?.total_organizers || 0,
        totalProducts: data.data?.total_products || 0,
        totalSellers: data.data?.total_sellers || 0,
        totalBuyers: data.data?.total_buyers || 0,
        monthlyGrowth: {
          revenue: data.data?.monthly_growth?.revenue || 0,
          events: data.data?.monthly_growth?.events || 0,
          organizers: data.data?.monthly_growth?.organizers || 0,
          products: data.data?.monthly_growth?.products || 0,
          sellers: data.data?.monthly_growth?.sellers || 0,
          buyers: data.data?.monthly_growth?.buyers || 0
        },
        recentActivities: data.data?.recent_activities || []
      };
      
      console.log('Transformed analytics:', analytics);
      return analytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Return default values that match the expected structure
      return {
        totalRevenue: 0,
        totalEvents: 0,
        totalOrganizers: 0,
        totalProducts: 0,
        totalSellers: 0,
        totalBuyers: 0,
        monthlyGrowth: {
          revenue: 0,
          events: 0,
          organizers: 0,
          products: 0,
          sellers: 0,
          buyers: 0
        },
        recentActivities: []
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
        // Transform snake_case to camelCase for the frontend
        createdAt: buyer.created_at || buyer.createdAt || new Date().toISOString()
      }));
      
      console.log(`Fetched ${buyers.length} buyers`);
      return buyers;
    } catch (error) {
      console.error('Error fetching buyers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
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
  markEventAsPaid: async (eventId: string, withdrawalMethod?: string, withdrawalDetails?: any) => {
    try {
      const response = await api.patch(`/admin/events/${eventId}/mark-paid`, {
        withdrawalMethod: withdrawalMethod || 'manual',
        withdrawalDetails: withdrawalDetails || {}
      });
      
      return response.data;
    } catch (error) {
      console.error('Error marking event as paid:', error);
      throw error;
    }
  }
};

export default adminApi;
