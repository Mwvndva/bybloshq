import axios from 'axios';
import apiClient from '@/lib/apiClient';
import { Order, OrderStatus } from '@/types/order';
import { ProductType } from '@/types/index';

// Interfaces
export type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

export interface Seller {
  id: number;
  fullName: string;
  full_name?: string;
  shopName: string;
  shop_name?: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  hasPhysicalShop?: boolean;
  physicalAddress?: string;
  physical_address?: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  banner_image?: string;
  theme?: Theme;
  balance?: number;
  total_sales?: number;
  net_revenue?: number;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  instagramLink?: string;
  clientCount?: number;
  client_count?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  aesthetic: string;
  sellerId: string;
  isSold: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  is_digital?: boolean;
  digital_file_path?: string;
  digital_file_name?: string;
  productType?: ProductType;
}

// Order types are now imported from '@/types/order'

interface SellerAnalytics {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalPayout: number;
  balance: number;
  pendingDebt: number;
  pendingDebtCount: number;
  monthlySales: Array<{ month: string; sales: number }>;
  recentOrders?: Array<{
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    items: Array<{
      id: number;
      product_name: string;
      quantity: number;
      price: number;
    }>;
  }>;
  recentDebts?: Array<{
    id: number;
    amount: number;
    clientName: string;
    clientPhone: string;
    productName: string;
    createdAt: string;
  }>;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  mpesaNumber: string;
  mpesaName: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

// Use the unified API client
const sellerApiInstance = apiClient;

// Helper function to transform product data
const transformProduct = (product: any): Product => {
  // Safely convert price to number
  let price = 0;
  if (product.price !== null && product.price !== undefined) {
    if (typeof product.price === 'number') {
      price = product.price;
    } else if (typeof product.price === 'string') {
      const parsed = parseFloat(product.price);
      price = isNaN(parsed) ? 0 : parsed;
    } else if (typeof product.price === 'object') {
      // Handle price objects (e.g., { value: 100, currency: 'KES' })
      const numericValue = product.price.value || product.price.amount || product.price.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  return {
    ...product,
    price: price, // Ensure price is always a number
    image_url: product.image_url || product.imageUrl,
    sellerId: product.sellerId || product.seller_id,
    createdAt: product.createdAt || product.created_at,
    updatedAt: product.updatedAt || product.updated_at,
    isSold: product.isSold || product.is_sold || product.status === 'sold',
    status: product.status || (product.isSold || product.is_sold ? 'sold' : 'available')
  };
};

// Helper function to transform seller data
const transformSeller = (data: any): Seller => {
  // Handle case where seller data is nested under a 'seller' property
  const seller = data.seller || data;

  return {
    id: seller.id,
    fullName: seller.fullName || seller.full_name || '',
    shopName: seller.shopName || seller.shop_name || '',
    email: seller.email || '',
    phone: seller.phone || seller.whatsapp_number || '',
    whatsappNumber: seller.whatsapp_number || seller.whatsappNumber || seller.phone || '',
    city: seller.city || '',
    location: seller.location || '',
    physicalAddress: seller.physicalAddress || seller.physical_address || '',
    hasPhysicalShop: seller.hasPhysicalShop || !!seller.physicalAddress || !!seller.physical_address,
    latitude: seller.latitude,
    longitude: seller.longitude,
    bannerImage: seller.bannerImage || seller.banner_image || null,
    theme: seller.theme || 'black',
    instagramLink: seller.instagramLink || seller.instagram_link || '',
    clientCount: seller.clientCount || seller.client_count || 0,
    createdAt: seller.createdAt || seller.created_at || new Date().toISOString(),
    updatedAt: seller.updatedAt || seller.updated_at || new Date().toISOString()
  };
};

interface ShopNameAvailabilityResponse {
  data: {
    available: boolean;
  };
}

// Check if shop name is available
export const checkShopNameAvailability = async (shopName: string): Promise<{ available: boolean }> => {
  try {
    const response = await sellerApiInstance.get<ShopNameAvailabilityResponse>(`/sellers/check-shop-name?shopName=${encodeURIComponent(shopName)}`);
    return response.data.data;
  } catch (error) {
    console.error('Error checking shop name availability:', error);
    // If there's an error, we'll assume the shop name is not available to be safe
    return { available: false };
  }
};

// Define response interfaces
interface LoginResponse {
  data: {
    seller: Seller;
  };
}

interface RegisterResponse {
  data: {
    seller: Seller;
  };
}

interface ProductsResponse {
  data: {
    products: any[]; // We'll use transformProduct to convert to Product[]
  };
}

interface ProductResponse {
  data: any; // Will be transformed to Product type
}

interface SellerResponse {
  data: any; // Will be transformed to Seller type
}

interface AnalyticsResponse {
  data: SellerAnalytics;
}

interface ForgotPasswordResponse {
  message: string;
}

interface ResetPasswordResponse {
  message: string;
}

// API methods
export const sellerApi = {
  // Auth
  login: async (credentials: { email: string; password: string }): Promise<{ seller: Seller }> => {
    try {
      const response = await sellerApiInstance.post<LoginResponse>('/sellers/login', credentials);
      const responseData = response.data.data;

      if (!responseData) {
        throw new Error('Invalid response from server');
      }

      const { seller } = responseData;

      if (!seller) {
        throw new Error('Invalid response from server - missing seller');
      }

      // Token is handled via HttpOnly cookie
      return { seller: transformSeller(seller) };
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  register: async (data: {
    fullName: string;
    shopName: string;
    email: string;
    whatsappNumber: string;
    password: string;
    confirmPassword: string;
    city?: string;
    location?: string;
  }): Promise<{ seller: Seller }> => {
    try {
      const response = await sellerApiInstance.post<RegisterResponse>('/sellers/register', {
        fullName: data.fullName,
        shopName: data.shopName,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        password: data.password,
        confirmPassword: data.confirmPassword,
        city: data.city,
        location: data.location
      });

      // The response data structure is { data: { seller } }
      const responseData = response.data?.data;

      if (!responseData) {
        throw new Error('Invalid response from server');
      }

      const { seller } = responseData;

      if (!seller) {
        throw new Error('Invalid response from server - missing seller');
      }

      // Token is handled via HttpOnly cookie
      return { seller: transformSeller(seller) };
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Products
  createProduct: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isSold'>): Promise<Product> => {
    const response = await sellerApiInstance.post('/sellers/products', product);
    return transformProduct(response.data);
  },

  getProducts: async (): Promise<Product[]> => {
    try {
      const response = await sellerApiInstance.get<ProductsResponse>('/sellers/products');
      const products = response.data?.data?.products || [];
      return products.map(transformProduct);
    } catch (error: any) {
      console.error('Error fetching products:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Public method to get products for a specific seller (no authentication required)
  getSellerProducts: async (sellerId: string | number): Promise<Product[]> => {
    try {
      // Use axios directly to avoid auth interceptor
      const response = await axios.get<ProductsResponse>(`/sellers/${sellerId}/products`, {
        baseURL: apiClient.defaults.baseURL
      });
      // Handle both response structures: { data: { products: [] } } or { products: [] }
      let products: any[] = [];
      if (response.data?.data?.products) {
        products = response.data.data.products;
      } else if (Array.isArray(response.data?.data)) {
        products = response.data.data;
      } else if (Array.isArray(response.data)) {
        products = response.data;
      }
      return products.map(transformProduct);
    } catch (error: any) {
      console.error('Error fetching seller products:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        sellerId
      });
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  getProduct: async (id: string): Promise<Product> => {
    try {
      const response = await sellerApiInstance.get<ProductResponse>(`/sellers/products/${id}`);
      const productData = response.data?.data?.product;
      if (!productData) {
        throw new Error('Product not found');
      }
      return transformProduct(productData);
    } catch (error: any) {
      console.error('Error fetching product:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const response = await sellerApiInstance.patch(`/sellers/products/${id}`, updates);
    return transformProduct(response.data);
  },

  updateInventory: async (id: string, inventoryData: {
    track_inventory: boolean;
    quantity: number | null;
    low_stock_threshold: number | null;
  }): Promise<Product> => {
    const response = await sellerApiInstance.patch(`/sellers/products/${id}/inventory`, inventoryData);
    return transformProduct(response.data);
  },

  deleteProduct: async (id: string): Promise<void> => {
    await sellerApiInstance.delete(`/sellers/products/${id}`);
  },

  // Seller
  getProfile: async (): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>('/sellers/profile');
      const profileData = response.data?.data?.seller;
      if (!profileData) {
        throw new Error('No profile data received');
      }
      return transformSeller(profileData);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  getSellerById: async (id: string | number): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/${id}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error: any) {
      console.error('Error fetching seller:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  async getSellerByShopName(shopName: string): Promise<Seller> {
    try {
      const response = await sellerApiInstance.get<SellerResponse>(`/sellers/shop/${encodeURIComponent(shopName)}`);
      const sellerData = response.data?.data;
      if (!sellerData) {
        throw new Error('No seller data received');
      }
      return transformSeller(sellerData);
    } catch (error: any) {
      console.error('Error fetching seller by shop name:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Analytics
  getAnalytics: async (): Promise<SellerAnalytics> => {
    try {
      const response = await sellerApiInstance.get<AnalyticsResponse>('/sellers/analytics');
      if (!response.data?.data) {
        throw new Error('No analytics data received');
      }
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  },

  // Auth - Forgot Password
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      // Use the public API endpoint directly
      const response = await axios.post<ForgotPasswordResponse>(
        `/sellers/forgot-password`,
        {
          email: email.trim().toLowerCase()
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          baseURL: apiClient.defaults.baseURL
        }
      );

      if (!response.data?.message) {
        throw new Error('Invalid response format from server');
      }

      return { message: response.data.message };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  // Reset Password
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    try {
      const response = await axios.post<ResetPasswordResponse>(
        `/sellers/reset-password`,
        { token, newPassword },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          baseURL: apiClient.defaults.baseURL
        }
      );

      if (!response.data?.message) {
        throw new Error('Invalid response format from server');
      }

      return { message: response.data.message };
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

  // Update seller profile
  updateProfile: async (data: { city?: string; location?: string; theme?: Theme; physicalAddress?: string; latitude?: number; longitude?: number }): Promise<Seller> => {
    try {
      const response = await sellerApiInstance.patch<{ data: Seller }>('/sellers/profile', data);
      return transformSeller(response.data.data);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Orders
  async getOrders(params?: { status?: OrderStatus }): Promise<Order[]> {
    const response = await sellerApiInstance.get<{ data: Order[] }>('/sellers/orders', { params });
    return response.data.data;
  },

  async getOrder(orderId: string): Promise<Order> {
    const response = await sellerApiInstance.get<{ data: Order }>(`/sellers/orders/${orderId}`);
    return response.data.data;
  },

  // Update seller theme
  async updateTheme(theme: Theme): Promise<{ theme: Theme }> {
    const response = await sellerApiInstance.patch<{ data: { theme: Theme } }>('/sellers/theme', { theme });
    return response.data.data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const response = await sellerApiInstance.patch<{ data: Order }>(
      `/sellers/orders/${orderId}`,
      { status }
    );
    return response.data.data;
  },

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string; refundAmount: number }> {
    const response = await sellerApiInstance.patch<{ success: boolean; message: string; refundAmount: number }>(
      `/orders/${orderId}/seller-cancel`
    );
    return response.data;
  },

  // Upload banner image
  async uploadBanner(bannerImage: string): Promise<{ bannerUrl: string }> {
    const response = await sellerApiInstance.post<{ data: { bannerUrl: string } }>('/sellers/upload-banner', { bannerImage });
    return response.data.data;
  },

  async getOrdersAnalytics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    revenue: number;
  }> {
    const response = await sellerApiInstance.get<{
      data: {
        total: number;
        pending: number;
        processing: number;
        shipped: number;
        delivered: number;
        cancelled: number;
        revenue: number;
      }
    }>('/sellers/orders/analytics');
    return response.data.data;
  },

  // Withdrawal requests
  async requestWithdrawal(data: {
    amount: number;
    mpesaNumber: string;
    mpesaName: string;
  }): Promise<WithdrawalRequest> {
    const response = await sellerApiInstance.post<{ data: WithdrawalRequest }>('/sellers/withdrawal-request', data);
    return response.data.data;
  },

  async getWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    const response = await sellerApiInstance.get<{ data: WithdrawalRequest[] }>('/sellers/withdrawal-requests');
    return response.data.data;
  },

  async uploadDigitalProduct(file: File): Promise<{ filePath: string; fileName: string }> {
    const formData = new FormData();
    formData.append('digital_file', file);

    const response = await sellerApiInstance.post<{
      status: string;
      data: {
        filePath: string;
        fileName: string;
        size: number;
      }
    }>('/sellers/products/upload-digital', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      filePath: response.data.data.filePath,
      fileName: response.data.data.fileName
    };
  },

  // Client Orders
  async createClientOrder(data: {
    clientName: string;
    clientPhone: string;
    paymentType?: 'stk' | 'debt';
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
  }): Promise<{
    success: boolean;
    order: {
      id: number;
      orderNumber: string;
      totalAmount: number;
      status: string;
    };
    payment: {
      id: number;
      reference: string;
    };
    message: string;
  }> {
    const response = await sellerApiInstance.post<{
      status: string;
      data: {
        success: boolean;
        order: {
          id: number;
          orderNumber: string;
          totalAmount: number;
          status: string;
        };
        payment: {
          id: number;
          reference: string;
        };
        message: string;
      };
    }>('/orders/client-order', {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      paymentType: data.paymentType,
      items: data.items
    });
    return response.data.data;
  },
};

export const withdrawalService = {
  createRequest: async (data: { amount: string; mpesaNumber: string; mpesaName: string }) => {
    const response = await sellerApiInstance.post('/sellers/withdrawal-request', data);
    return response.data;
  },

  getRequests: async () => {
    const response = await sellerApiInstance.get('/sellers/withdrawal-requests');
    return response.data;
  }
};

export const debtService = {
  initiatePayment: async (debtId: number) => {
    const response = await sellerApiInstance.post(`/sellers/debts/${debtId}/pay`);
    return response.data;
  }
};

export default sellerApi;
