import axios from 'axios';

interface Buyer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface LoginResponseData {
  token: string;
  buyer: Buyer;
}

export interface WishlistItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  sellerId: string;
  isSold: boolean;
  status: 'available' | 'sold';
  createdAt: string;
  updatedAt: string;
  aesthetic: string;
}

interface LoginApiResponse {
  status: string;
  token: string;
  data: {
    buyer: Buyer;
  };
}

interface LoginResponse {
  buyer: Buyer;
  token: string;
}

interface RegisterData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

// Use relative path in development to work with Vite proxy
const isDevelopment = import.meta.env.DEV;
const API_URL = isDevelopment 
  ? '/api'  // This will be proxied to the backend by Vite
  : (import.meta.env.VITE_API_URL || 'http://localhost:3002/api').replace(/\/$/, '');

// Create axios instance for buyer API
const buyerApiInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // Important for sending/receiving cookies
  timeout: 10000, // 10 second timeout
});

// Helper function to get the token
const getAuthToken = (): string | null => {
  return localStorage.getItem('buyer_token');
};

// Add a request interceptor to include the token from localStorage
buyerApiInstance.interceptors.request.use(
  (config) => {
    // Skip for login/register routes or if it's an OPTIONS request (preflight)
    const isAuthRequest = config.url?.includes('/login') || config.url?.includes('/register');
    const isOptionsRequest = config.method?.toLowerCase() === 'options';
    
    if (isAuthRequest || isOptionsRequest) {
      return config;
    }
    
    // Get token from localStorage
    const token = getAuthToken();
    
    if (token) {
      // Ensure headers object exists
      config.headers = config.headers || {};
      
      // Set the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      
      // Log the token being sent (remove in production)
      if (isDevelopment) {
        console.log('Sending request with token:', token.substring(0, 10) + '...');
      }
    } else if (isDevelopment) {
      console.warn('No auth token found for request to:', config.url);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
      localStorage.removeItem('buyer_token');
      if (!window.location.pathname.includes('login')) {
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
    createdAt: buyer.createdAt || buyer.created_at || new Date().toISOString(),
    updatedAt: buyer.updatedAt || buyer.updated_at
  };
};

import api from './api';

export const getBuyerProfile = () => buyerApiInstance.get('/buyers/profile');
export const updateBuyerProfile = (data: any) => buyerApiInstance.patch('/buyers/update-profile', data);

const buyerApi = {
  // Auth
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    try {
      const loginUrl = '/buyers/login';
      console.log(`Sending login request to ${loginUrl}`);
      
      // Clear any existing token first
      localStorage.removeItem('buyer_token');
      delete buyerApiInstance.defaults.headers.common['Authorization'];
      
      // Create a clean axios instance for login to avoid any interceptor issues
      const loginInstance = axios.create({
        baseURL: API_URL,
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
      console.log('Headers:', JSON.stringify(response.headers, null, 2));
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
      const responseData = response.data;
      
      if (!responseData) {
        throw new Error('Invalid response from server - no data received');
      }
      
      const { token, data } = responseData;
      
      if (!token) {
        throw new Error('No token received in login response');
      }
      
      if (!data?.buyer) {
        throw new Error('Invalid response from server - missing buyer data');
      }
      
      const { buyer } = data;
      
      // Store the token in localStorage
      localStorage.setItem('buyer_token', token);
      
      // Set the default Authorization header for future requests
      buyerApiInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify the token is stored correctly
      const storedToken = localStorage.getItem('buyer_token');
      console.log('Token stored in localStorage:', storedToken ? 'Yes' : 'No');
      
      return { buyer: transformBuyer(buyer), token };
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    try {
      // Add proper type to the response - backend returns token and data directly
      const response = await buyerApiInstance.post<{
        status: string;
        message: string;
        token: string;
        data: {
          buyer: Buyer;
        };
      }>('/buyers/register', data);
      
      console.log('=== REGISTRATION RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
      const responseData = response.data;
      
      if (!responseData) {
        throw new Error('Invalid response from server');
      }
      
      const { buyer } = responseData.data;
      const { token } = responseData;
      
      if (!buyer || !token) {
        throw new Error('Invalid response from server - missing buyer or token');
      }
      
      localStorage.setItem('buyer_token', token);
      return { buyer: transformBuyer(buyer), token };
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await axios.post<{ message: string }>(
        `${API_URL}/buyers/forgot-password`, 
        { email: email.trim().toLowerCase() },
        { 
          headers: { 'Content-Type': 'application/json' } 
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
        `${API_URL}/buyers/reset-password`,
        { token, newPassword },
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          } 
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
      
      const response = await buyerApiInstance.get<ProfileResponse>('/buyers/profile');
      
      console.log('Profile response:', response.data);
      
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

  // Wishlist methods
  getWishlist: async (): Promise<WishlistItem[]> => {
    try {
      console.log('🔍 API - Fetching wishlist...');
      const token = localStorage.getItem('buyer_token');
      console.log('🔑 API - Current auth token:', token ? `Exists (${token.substring(0, 20)}...)` : 'Missing');
      console.log('🌐 API - Request headers:', buyerApiInstance.defaults.headers.common);
      
      const response = await buyerApiInstance.get<ApiResponse<{ items: WishlistItem[] }>>('/buyers/wishlist', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
      
      console.log('📦 API - Wishlist response status:', response.status);
      console.log('📦 API - Wishlist response data:', response.data);
      
      // Check if the response has the expected structure
      if (!response.data?.success || !response.data.data?.items) {
        console.warn('⚠️ API - Unexpected response format from wishlist endpoint:', {
          success: response.data?.success,
          hasData: !!response.data?.data,
          hasItems: !!response.data?.data?.items,
          fullResponse: response.data
        });
        return [];
      }
      
      // Return the items array
      const items = Array.isArray(response.data.data.items) ? response.data.data.items : [];
      console.log('✅ API - Returning wishlist items:', items.map(item => ({ id: item.id, name: item.name })));
      return items;
    } catch (error: any) {
      console.error('Error fetching wishlist:', error);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.status === 401) {
          console.log('Authentication failed, clearing token and redirecting to login');
          localStorage.removeItem('buyer_token');
          delete buyerApiInstance.defaults.headers.common['Authorization'];
          window.location.href = '/buyer/login';
        }
      }
      
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
      console.log('API - Add to wishlist response:', response.data);
      
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
        console.log('Authentication failed, clearing token and redirecting to login');
        localStorage.removeItem('buyer_token');
        delete buyerApiInstance.defaults.headers.common['Authorization'];
        window.location.href = '/buyer/login';
      }
      
      // Handle duplicate entry (409) - throw error to be caught by frontend
      if (error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || 'Product already in wishlist';
        throw new Error(errorMessage);
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
      
      console.log('API - Remove from wishlist response:', response.data);
      
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
          console.log('Authentication failed, clearing token and redirecting to login');
          localStorage.removeItem('buyer_token');
          delete buyerApiInstance.defaults.headers.common['Authorization'];
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
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.status === 401) {
          console.log('Authentication failed, clearing token and redirecting to login');
          localStorage.removeItem('buyer_token');
          delete buyerApiInstance.defaults.headers.common['Authorization'];
          window.location.href = '/buyer/login';
        }
      }
      
      return false;
    }
  }
};

export default buyerApi;
