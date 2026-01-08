import axios from 'axios';

interface Buyer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  location?: string;
  refunds?: number;
  createdAt: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface LoginResponseData {
  buyer: Buyer;
  // Token is now in cookie
}

export interface WishlistItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  sellerId: string;
  sellerName?: string;
  isSold: boolean;
  status: 'available' | 'sold';
  createdAt: string;
  updatedAt: string;
  aesthetic: string;
}

interface LoginApiResponse {
  status: string;
  data: {
    buyer: Buyer;
  };
}

interface LoginResponse {
  buyer: Buyer;
}

interface RegisterData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  city: string;
  location: string;
}

// Get the base URL from environment variables
const API_URL = (import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002/api' : 'https://bybloshq-f1rz.onrender.com/api')
).replace(/\/$/, '');
const isDevelopment = import.meta.env.DEV;

// For development, we'll use the proxy if VITE_API_URL is not set
const baseURL = isDevelopment && !import.meta.env.VITE_API_URL
  ? '/api'  // Use proxy in development when VITE_API_URL is not set
  : API_URL; // Otherwise use the provided API_URL or default

// Create axios instance for buyer API
const buyerApiInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
  withCredentials: true, // Important for sending/receiving cookies
  timeout: 30000, // Increase timeout to 30 seconds
});

// Add a response interceptor to handle 404s for wishlist deletions
buyerApiInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // If this is a 404 from a DELETE request to the wishlist endpoint, resolve instead of reject
    if (
      error.config &&
      error.response?.status === 404 &&
      error.config.method?.toLowerCase() === 'delete' &&
      error.config.url?.includes('/wishlist/')
    ) {
      // Return a resolved promise with a custom response
      return Promise.resolve({
        data: { success: true, message: 'Item not found in wishlist' },
        status: 200,
        statusText: 'OK',
        config: error.config,
        headers: {}
      });
    }

    // For all other errors, reject the promise
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
buyerApiInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're just checking the profile/auth status
      // This prevents redirect loops when the app initializes with an expired token
      if (error.config?.url?.includes('/buyers/profile')) {
        return Promise.reject(error);
      }

      if (!window.location.pathname.includes('login')) {
        // Redirect to login if unauthorized for other requests
        window.location.href = '/buyer/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to transform buyer data
const transformBuyer = (data: any): Buyer => {
  const buyer = data.buyer || data;
  return {
    id: buyer.id,
    fullName: buyer.fullName || buyer.full_name || '',
    email: buyer.email || '',
    phone: buyer.phone || '',
    city: buyer.city || '',
    location: buyer.location || '',
    refunds: buyer.refunds != null ? parseFloat(buyer.refunds) : 0,
    createdAt: buyer.createdAt || buyer.created_at || new Date().toISOString(),
    updatedAt: buyer.updatedAt || buyer.updated_at
  };
};

import api from './api';
import { Order, OrderStatus, OrderItem, PaymentStatus } from '@/types/order';

export const getBuyerProfile = () => buyerApiInstance.get('/buyers/profile');
export const updateBuyerProfile = (data: any) => buyerApiInstance.patch('/buyers/update-profile', data);

const buyerApi = {
  // Auth
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    try {
      const loginUrl = '/buyers/login';
      console.log(`Sending login request to ${loginUrl}`);

      // Create a clean axios instance for login to avoid any interceptor issues
      const loginInstance = axios.create({
        baseURL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        withCredentials: true,
        timeout: 10000,
      });

      // Make the login request with proper typing
      const response = await loginInstance.post<LoginApiResponse>(
        loginUrl,
        credentials
      );

      console.log('=== LOGIN RESPONSE ===');
      console.log('Status:', response.status);

      const responseData = response.data;

      if (!responseData) {
        throw new Error('Invalid response from server - no data received');
      }

      // Backend now sets HttpOnly cookie. We minimaly expect buyer data.
      // If token is present in body we ignore it for storage, but it might be there during transition.

      const { data } = responseData;

      if (!data?.buyer) {
        throw new Error('Invalid response from server - missing buyer data');
      }

      const { buyer } = data;

      // Set the default Authorization header to empty/null just in case
      delete buyerApiInstance.defaults.headers.common['Authorization'];

      return { buyer: transformBuyer(buyer) };
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    try {
      // Add proper type to the response - backend returns token and data directly
      const response = await buyerApiInstance.post<{
        status: string;
        message: string;
        data: {
          buyer: Buyer;
        };
      }>('/buyers/register', data);

      console.log('=== REGISTRATION RESPONSE ===');
      console.log('Status:', response.status);

      const responseData = response.data;

      if (!responseData) {
        throw new Error('Invalid response from server');
      }

      const { buyer } = responseData.data;

      if (!buyer) {
        throw new Error('Invalid response from server - missing buyer');
      }

      return { buyer: transformBuyer(buyer) };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await axios.post<{ message: string }>(
        `${baseURL}/buyers/forgot-password`,
        { email: email.trim().toLowerCase() },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        }
      );

      // Ensure the response has a message property
      if (!response.data || typeof response.data.message !== 'string') {
        return { message: 'Password reset email sent successfully' };
      }

      return response.data;
    } catch (error: any) {
      console.error('Forgot password error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    try {
      const response = await axios.post<{ message: string }>(
        `${baseURL}/buyers/reset-password`,
        { token, newPassword },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          withCredentials: true
        }
      );

      // Ensure the response has a message property
      if (!response.data || typeof response.data.message !== 'string') {
        return { message: 'Password has been reset successfully' };
      }

      return response.data;
    } catch (error: any) {
      console.error('Reset password error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      } else if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('An unknown error occurred while resetting your password.');
    }
  },

  getProfile: async (): Promise<Buyer> => {
    try {
      // Define the expected response type
      interface ProfileResponse {
        status: string;
        data: {
          buyer: Buyer;
        };
      }

      // We rely on the browser sending the HttpOnly cookie
      const response = await buyerApiInstance.get<ProfileResponse>('/buyers/profile');

      // The buyer data is in response.data.data.buyer
      const buyerData = response.data.data?.buyer;

      if (!buyerData) {
        throw new Error('No profile data received');
      }

      return transformBuyer(buyerData);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Wishlist methods with retry logic
  getWishlist: async (maxRetries = 2, retryCount = 0): Promise<WishlistItem[]> => {
    try {
      console.log(`🔍 API - Fetching wishlist (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      const response = await buyerApiInstance.get<ApiResponse<{ items: WishlistItem[] }>>('/buyers/wishlist', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        timeout: 15000 // Increase timeout to 15 seconds
      });

      // Check if the response has the expected structure
      if (!response.data?.success || !response.data.data?.items) {
        console.warn('⚠️ API - Unexpected response format from wishlist endpoint:', {
          success: response.data?.success,
          hasData: !!response.data?.data,
          hasItems: !!response.data?.data?.items,
          fullResponse: response.data
        });
        throw new Error('Invalid response format from server');
      }

      // Return the items array
      const items = Array.isArray(response.data.data.items) ? response.data.data.items : [];
      console.log('✅ API - Successfully fetched wishlist items:', items.length);
      return items;

    } catch (error: any) {
      console.error(`❌ Attempt ${retryCount + 1} failed:`, error.message);

      // Handle timeout specifically
      if ((error.code === 'ECONNABORTED' || error.message.includes('timeout')) && retryCount < maxRetries) {
        console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return buyerApi.getWishlist(maxRetries, retryCount + 1);
      }

      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        console.log('🔒 Authentication failed, redirecting to login');
        window.location.href = '/buyer/login';
      }

      // For other errors, return empty array but don't retry
      return [];
    }
  },

  addToWishlist: async (product: { id: string }): Promise<boolean> => {
    try {
      console.log('API - Adding to wishlist:', product);
      const response = await buyerApiInstance.post<ApiResponse<any>>(
        '/buyers/wishlist',
        { productId: product.id }
      );


      // Check if the response indicates success
      if (response.data?.success) {
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('API - Error adding to wishlist:', {
        error: error.response?.data || error.message,
        status: error.response?.status
      });

      if (error.response?.status === 401) {
        console.log('Authentication failed, redirecting to login');
        window.location.href = '/buyer/login';
      }

      // Handle duplicate entry (409) - throw error to be caught by frontend
      if (error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || 'Product already in wishlist';
        const err = new Error(errorMessage) as Error & { code?: string };
        err.code = 'DUPLICATE_WISHLIST_ITEM';
        throw err;
      }

      return false;
    }
  },

  removeFromWishlist: async (productId: string): Promise<boolean> => {
    try {
      console.log('Removing from wishlist:', productId);
      const response = await buyerApiInstance.delete<ApiResponse<void>>(
        `/buyers/wishlist/${productId}`
      );



      // Check if the response indicates success
      if (response.data?.success) {
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Error removing from wishlist:', error);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);

        if (error.response.status === 401) {
          console.log('Authentication failed, redirecting to login');
          window.location.href = '/buyer/login';
        }

        // Handle 404 as success since item is not in wishlist (already removed)
        if (error.response.status === 404) {
          console.log('Product not found in wishlist (already removed)');
          return true;
        }
      }

      return false;
    }
  },

  syncWishlist: async (items: WishlistItem[]): Promise<boolean> => {
    try {
      console.log('Syncing wishlist with server:', items);
      await buyerApiInstance.put<ApiResponse<void>>(
        '/buyers/wishlist/sync',
        { items }
      );
      return true;
    } catch (error: any) {
      console.error('Error syncing wishlist:', error);

      if ((error as any).response?.status === 401) {
        window.location.href = '/buyer/login';
      }

      return false;
    }
  },

  // Order methods
  getOrders: async (): Promise<Order[]> => {
    try {
      const response = await buyerApiInstance.get<ApiResponse<any[]>>('/orders/user');
      // Transform the response to match the Order type
      return response.data.data.map(order => ({
        ...order,
        // Map snake_case to camelCase for the frontend
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method,
        shippingAddress: order.shipping_address,
        // Ensure items is always an array
        items: order.items || [],
        // Ensure status is in uppercase to match backend
        status: order.status?.toUpperCase() || 'PENDING',
        // Ensure paymentStatus is in uppercase to match backend
        paymentStatus: order.payment_status?.toUpperCase() || 'PENDING'
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },

  getOrder: async (orderId: string): Promise<Order> => {
    try {
      const response = await buyerApiInstance.get<ApiResponse<Order>>(`/orders/${orderId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  },

  cancelOrder: async (orderId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await buyerApiInstance.patch(`/orders/${orderId}/cancel`);
      return { success: true };
    } catch (error: any) {
      console.error(`Error cancelling order ${orderId}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to cancel order'
      };
    }
  },

  confirmOrderReceipt: async (orderId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log(`Sending confirm receipt request for order ${orderId}...`);
      const response = await buyerApiInstance.patch(`/orders/${orderId}/confirm-receipt`, {}, {
        timeout: 30000 // 30 seconds timeout for this specific request
      });

      return { success: true };
    } catch (error: any) {
      console.error(`Error confirming receipt for order ${orderId}:`, error);

      let errorMessage = 'Failed to confirm order receipt';

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your internet connection and try again.';
      } else if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = error.response.data?.message || error.response.statusText || 'Server error occurred';
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please try again later.';
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  },

  // Check if buyer exists by phone number (public endpoint - no auth required)
  checkBuyerByPhone: async (phone: string): Promise<{
    exists: boolean;
    buyer?: Buyer;
    token?: string;
  }> => {
    try {


      // Use a fresh axios instance to avoid auth interceptor
      const response = await axios.create({}).post<{
        status: string;
        data: {
          exists: boolean;
          buyer?: Buyer;
          token?: string;
        }
      }>(
        `${baseURL}/buyers/check-phone`,
        { phone },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );


      if (!response.data || response.data.status !== 'success') {
        throw new Error('Failed to check buyer information');
      }
      return response.data.data;
    } catch (error: any) {
      console.error('Error checking buyer by phone:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to check buyer information. Please try again.');
    }
  },

  saveBuyerInfo: async (buyerInfo: {
    fullName: string;
    email: string;
    phone: string;
    city?: string;
    location?: string;
  }): Promise<{ buyer?: Buyer; token?: string; message?: string; requiresLogin?: boolean; exists?: boolean }> => {
    try {


      // Use the public API endpoint that doesn't require authentication
      const response = await axios.post<{ status: string; data: { buyer?: Buyer; token?: string; message?: string } }>(
        `${baseURL}/buyers/save-info`,
        buyerInfo,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );



      if (!response.data || response.data.status !== 'success') {
        throw new Error(response.data?.data?.message || 'Failed to save buyer information');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('Error saving buyer info:', error);

      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }

      throw new Error('Failed to save buyer information. Please try again.');
    }
  },

  // Request refund withdrawal (uses buyer's existing details)
  requestRefund: async (data: {
    amount: number;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await buyerApiInstance.post('/buyers/refund-request', data);
      return { success: true, message: (response.data as any)?.message || 'Refund request submitted successfully' };
    } catch (error: any) {
      console.error('Error requesting refund:', error);
      throw new Error(error.response?.data?.message || 'Failed to submit refund request');
    }
  },

  // Get pending refund requests
  getPendingRefundRequests: async (): Promise<{
    pendingRequests: Array<{
      id: number;
      amount: number;
      status: string;
      requested_at: string;
    }>;
    hasPending: boolean;
  }> => {
    try {
      const response = await buyerApiInstance.get('/buyers/refund-requests/pending');
      return (response.data as any)?.data || { hasPending: false, requests: [] };
    } catch (error: any) {
      console.error('Error fetching pending refund requests:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch pending refund requests');
    }
  },

  downloadDigitalProduct: async (orderId: string, productId: string): Promise<void> => {
    try {
      const response = await buyerApiInstance.get(`/orders/${orderId}/download/${productId}`, {
        responseType: 'blob', // Important for file downloads
      });

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data as any]));
      const link = document.createElement('a');
      link.href = url;

      // Try to get filename from content-disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'download.zip';
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading digital product:', error);
      throw new Error(error.response?.data?.message || 'Failed to download digital product');
    }
  }
};

export default buyerApi;



