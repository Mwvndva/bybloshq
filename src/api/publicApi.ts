import axios from 'axios';
import { getFreshCsrfToken, getCachedCsrfToken, setCachedCsrfToken } from '@/lib/apiClient';

type AxiosInstance = any;
type AxiosRequestConfig = any;


// Extend the AxiosRequestConfig interface to include our custom options
interface CustomAxiosRequestConfig extends Record<string, any> {
  skipAuth?: boolean;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  [key: string]: any;
}

// Create a custom axios instance with our custom config
class CustomAxios {
  private instance: any;

  constructor() {
    // Use VITE_API_URL from environment variables or fallback to relative path for development
    let baseURL = import.meta.env.VITE_API_URL || '/api';

    // Ensure baseURL ends with /api
    if (!baseURL.endsWith('/api')) {
      baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
    }

    console.log('API Base URL:', baseURL); // Debug log

    this.instance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important for cookies if using sessions
    });

    // Add request interceptor for CSRF and auth cleanup
    this.instance.interceptors.request.use(
      async (config: any) => {
        // 1. Attach CSRF token to non-GET requests
        if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
          let token = getCachedCsrfToken();

          if (!token) {
            token = await getFreshCsrfToken();
          }

          if (token) {
            config.headers['X-CSRF-Token'] = token;
          }
        }

        // 2. Public API must NOT attach any Authorization header.
        // It relies purely on httpOnly cookies via withCredentials: true.
        if (config.headers) {
          delete config.headers.Authorization;
          delete config.headers.authorization;
        }
        return config;
      },
      (error: any) => {
        throw error;
      }
    );

    // Add response interceptor for CSRF retries (Sync with apiClient)
    this.instance.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        const status = error.response?.status;
        const message = error.response?.data?.message || '';
        const config = error.config;

        if (status === 403 && message.includes('CSRF mismatch') && !config._retry) {
          config._retry = true;
          console.warn('[CSRF-Public] Mismatch detected. Refreshing token and retrying...');

          const newToken = await getFreshCsrfToken();
          if (newToken) {
            config.headers['X-CSRF-Token'] = newToken;
            return this.instance(config);
          }
        }
        throw error;
      }
    );
  }

  // Allow access to the instance for cleanup
  public getInstance() {
    return this.instance;
  }

  // Proxy axios methods with proper typing
  public get(url: string, config?: CustomAxiosRequestConfig) {
    return this.instance.get(url, config);
  }

  public post(url: string, data?: any, config?: CustomAxiosRequestConfig) {
    return this.instance.post(url, data, config);
  }

  public put(url: string, data?: any, config?: CustomAxiosRequestConfig) {
    return this.instance.put(url, data, config);
  }

  public delete(url: string, config?: CustomAxiosRequestConfig) {
    return this.instance.delete(url, config);
  }
}

// Create a single instance of our custom axios
export const publicApi = new CustomAxios();

interface ApiResponse<T> {
  data?: T;
  products?: T[];
  error?: string;
  status: number;
  statusText: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  sellerId: string;
  seller_id?: string;
  isSold: boolean;
  is_sold?: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  sold_at?: string | null;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  seller?: Seller;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProductListResponse {
  products: Product[];
  pagination: PaginationMeta;
}

export interface SellerListResponse {
  sellers: Seller[];
  pagination: PaginationMeta;
}

export interface Seller {
  id: string;
  fullName: string;
  full_name?: string;
  email: string;
  phone: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;  // Add bannerUrl to the interface
  banner_url?: string; // Also support the snake_case version
  theme?: string;
  location?: string;
  city?: string;
  website?: string;
  socialMedia?: Record<string, string>;
  shopName?: string;   // Add shopName to match the transform function
  shop_name?: string;  // Also support the snake_case version
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  // Physical shop fields
  hasPhysicalShop?: boolean;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  totalWishlistCount?: number;
  clientCount?: number;
}

// Helper function to transform product data from API
const transformProduct = (product: any): Product => {
  // Safely convert price to number
  let price = 0;
  if (product.price !== null && product.price !== undefined) {
    if (typeof product.price === 'number') {
      price = product.price;
    } else if (typeof product.price === 'string') {
      const parsed = Number.parseFloat(product.price);
      price = Number.isNaN(parsed) ? 0 : parsed;
    } else if (typeof product.price === 'object') {
      // Handle price objects (e.g., { value: 100, currency: 'KES' })
      const numericValue = product.price.value || product.price.amount || product.price.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  const transformedProduct: any = {
    ...product,
    price: price, // Ensure price is always a number
    image_url: product.image_url || product.imageUrl,
    sellerId: product.sellerId || product.seller_id,
    isSold: product.isSold || product.is_sold || product.status === 'sold',
    status: product.status || (product.isSold || product.is_sold ? 'sold' : 'available'),
    createdAt: product.createdAt || product.created_at,
    updatedAt: product.updatedAt || product.updated_at,
    soldAt: product.soldAt || product.sold_at
  };

  // Preserve the seller object if it exists
  if (product.seller) {
    transformedProduct.seller = transformSeller(product.seller);
  }

  return transformedProduct as Product;
};

// Helper function to transform seller data from API
export function transformSeller(seller: any): Seller | null {
  if (!seller) return null;
  return {
    id: seller.id,
    fullName: seller.full_name || seller.fullName || 'Unknown Seller',
    email: seller.email || '',
    phone: seller.phone || '',
    // Required fields with default values
    bannerUrl: seller.banner_url || seller.bannerUrl || '',
    shopName: seller.shop_name || seller.shopName || 'My Shop',
    // Timestamps
    createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
    updatedAt: seller.updated_at || seller.updatedAt || new Date().toISOString(),
    theme: seller.theme || 'black',
    // Optional fields
    ...(seller.bio && { bio: seller.bio }),
    ...(seller.avatar_url && { avatarUrl: seller.avatar_url }),
    ...(seller.avatarUrl && { avatarUrl: seller.avatarUrl }), // Handle both cases
    ...(seller.location && { location: seller.location }),
    ...(seller.city && { city: seller.city }),
    ...(seller.website && { website: seller.website }),
    ...(seller.social_media && { socialMedia: seller.social_media }),
    ...(seller.socialMedia && { socialMedia: seller.socialMedia }), // Handle both cases
    // Physical shop fields
    hasPhysicalShop: seller.hasPhysicalShop || !!seller.physicalAddress || !!seller.physical_address,
    ...(seller.physicalAddress && { physicalAddress: seller.physicalAddress }),
    ...(seller.physical_address && { physicalAddress: seller.physical_address }), // Handle both cases
    ...(seller.latitude && { latitude: seller.latitude }),
    ...(seller.longitude && { longitude: seller.longitude }),
    // Metrics
    ...(seller.clientCount !== undefined && { clientCount: Number(seller.clientCount) }),
    ...(seller.client_count !== undefined && { clientCount: Number(seller.client_count) })
  };
}

export const publicApiService = {
  // Search for sellers by city and optional location
  searchSellers: async (filters: { city: string; location?: string }): Promise<Seller[]> => {
    try {
      // Build the query parameters
      const params = new URLSearchParams();
      params.append('city', filters.city);

      if (filters.location) {
        params.append('location', filters.location);
      }

      console.log('Searching for sellers with params:', { city: filters.city, location: filters.location });

      // This endpoint needs to be implemented on your backend
      const response = await publicApi.get(`sellers/search?${params.toString()}`);

      // Handle response - expect an array of sellers
      let sellersData: any[] = [];
      const responseData = response.data;

      if (Array.isArray(responseData)) {
        sellersData = responseData;
      } else if (responseData && 'data' in responseData && Array.isArray(responseData.data)) {
        sellersData = responseData.data;
      } else if (responseData && 'sellers' in responseData && Array.isArray(responseData.sellers)) {
        sellersData = responseData.sellers;
      }

      console.log(`Found ${sellersData.length} sellers for city: ${filters.city}${filters.location ? `, location: ${filters.location}` : ''}`);

      return sellersData.map(transformSeller).filter((seller): seller is Seller => seller !== null);
    } catch (error: any) {
      console.error('Error searching for sellers:', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response',
        stack: error.stack
      });
      return [];
    }
  },

  // Get all active sellers with wishlist count
  getSellersPage: async (params: { page?: number; limit?: number } = {}): Promise<SellerListResponse> => {
    try {
      const response = await publicApi.get('public/sellers/active', { params });
      let sellersData: any[] = [];
      const responseData = response.data;

      if (Array.isArray(responseData)) {
        sellersData = responseData;
      } else if (responseData && 'data' in responseData && responseData.data.sellers) {
        sellersData = responseData.data.sellers;
      } else if (responseData && 'sellers' in responseData) {
        sellersData = responseData.sellers;
      }

      const paginationSource = responseData?.pagination || responseData?.data?.pagination || {};
      const sellers = sellersData.map(item => {
        const seller = transformSeller(item);
        if (seller) {
          // Add extra property for this specific view if needed, but Seller interface usually is enough.
          // We might need to extend Seller interface if we want to type totalWishlistCount strictly,
          // but for now let's attach it or just rely on the fact that the API returns it.
          // Since TypeScript interface doesn't have it, we might need to add it or just ignore it for now.
          // Actually, let's update the Seller interface in the next step or right here if possible.
          // For now, let's just return the seller object as is, assuming the component will cast it or we update type.
          return {
            ...seller,
            totalWishlistCount: Number(item.totalWishlistCount || item.total_wishlist_count || 0)
          } as Seller;
        }
        return null;
      }).filter((seller): seller is Seller => seller !== null);

      return {
        sellers,
        pagination: {
          page: Number(paginationSource.page || params.page || 1),
          pageSize: Number(paginationSource.pageSize || params.limit || sellers.length || 24),
          total: Number(paginationSource.total || sellers.length),
          hasMore: Boolean(paginationSource.hasMore)
        }
      };
    } catch (error) {
      console.error('Error fetching sellers:', error);
      return {
        sellers: [],
        pagination: {
          page: params.page || 1,
          pageSize: params.limit || 24,
          total: 0,
          hasMore: false
        }
      };
    }
  },

  getSellers: async (): Promise<Seller[]> => {
    const page = await publicApiService.getSellersPage({ page: 1, limit: 24 });
    return page.sellers;
  },

  getProductsPage: async (filters: { city?: string; location?: string; aesthetic?: string; page?: number; limit?: number } = {}): Promise<ProductListResponse> => {
    try {
      console.log('Starting getProducts with filters:', filters);
      const response = await publicApi.get('public/products', { params: filters });
      const responseData = response.data;
      let productsData: any[] = [];
      const pagination = responseData?.pagination || responseData?.data?.pagination || {
        total: 0,
        page: filters.page || 1,
        pageSize: filters.limit || productsData.length,
        hasMore: false
      };

      if (Array.isArray(responseData)) {
        productsData = responseData;
      } else if (Array.isArray(responseData?.data)) {
        productsData = responseData.data;
      } else if (Array.isArray(responseData?.data?.products)) {
        productsData = responseData.data.products;
      } else if (Array.isArray(responseData?.products)) {
        productsData = responseData.products;
      }

      console.log(`Fetched ${productsData.length} products from aggregated backend endpoint`);
      return {
        products: productsData.map(transformProduct),
        pagination: {
          total: Number(pagination.total || productsData.length),
          page: Number(pagination.page || filters.page || 1),
          pageSize: Number(pagination.pageSize || filters.limit || productsData.length),
          hasMore: Boolean(pagination.hasMore)
        }
      };
    } catch (error: any) {
      console.error('Error fetching products:', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response',
        stack: error.stack
      });
      return {
        products: [],
        pagination: {
          total: 0,
          page: filters.page || 1,
          pageSize: filters.limit || 0,
          hasMore: false
        }
      };
    }
  },

  // Get all products with city and location filters
  getProducts: async (filters: { city?: string; location?: string; aesthetic?: string; page?: number; limit?: number } = {}): Promise<Product[]> => {
    const result = await publicApiService.getProductsPage(filters);
    return result.products;
  },

  // Get a single product by ID
  getProduct: async (id: string): Promise<Product | null> => {
    try {
      const response = await publicApi.get(`public/products/${id}`);
      const productData = response.data.product || response.data;
      return productData ? transformProduct(productData) : null;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  },

  // Get seller public info
  getSellerInfo: async (sellerId: string): Promise<Seller | null> => {
    try {
      const response = await publicApi.get(`sellers/${sellerId}`);
      const sellerData = response.data.seller || response.data;
      return sellerData ? transformSeller(sellerData) : null;
    } catch (error: any) {
      console.error('Error fetching seller info:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return null;
    }
  },

  // Get featured products
  getFeaturedProducts: async (limit: number = 8): Promise<Product[]> => {
    try {
      const response = await publicApi.get(`public/products/featured?limit=${limit}`);
      let productsData: Product[] = [];
      const responseData = response.data; // No need for type assertion

      if (Array.isArray(responseData)) {
        productsData = responseData;
      } else if (responseData && 'products' in responseData && Array.isArray(responseData.products)) {
        productsData = responseData.products;
      } else if (responseData && 'data' in responseData && responseData.data && Array.isArray(responseData.data.products)) {
        productsData = responseData.data.products;
      } else if (responseData && 'data' in responseData && Array.isArray(responseData.data)) {
        productsData = responseData.data;
      }

      return productsData.map(transformProduct);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      return [];
    }
  },

  // Search products
  searchProducts: async (query: string, filters: Record<string, any> = {}): Promise<Product[]> => {
    try {
      const response = await publicApi.get('public/products/search', {
        params: { q: query, ...filters }
      });

      let productsData: Product[] = [];
      const responseData = response.data; // No need for type assertion

      if (Array.isArray(responseData)) {
        productsData = responseData;
      } else if (responseData && 'products' in responseData) {
        productsData = Array.isArray(responseData.products) ? responseData.products : [];
      } else if (responseData && 'data' in responseData && responseData.data) {
        if (Array.isArray(responseData.data.products)) {
          productsData = responseData.data.products;
        } else if (Array.isArray(responseData.data)) {
          productsData = responseData.data;
        }
      }

      return productsData.map(transformProduct);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  },

  // Get products by location
  getProductsByLocation: async (location: string): Promise<Product[]> => {
    try {
      // Use the main products endpoint with location filter
      const response = await publicApi.get('public/products', {
        params: { location }
      });

      let productsData: Product[] = [];
      const responseData = response.data as any; // Use type assertion to bypass TypeScript checks

      if (Array.isArray(responseData)) {
        productsData = responseData;
      } else if (responseData && 'products' in responseData) {
        productsData = Array.isArray(responseData.products) ? responseData.products : [];
      } else if (responseData && 'data' in responseData && responseData.data) {
        if (Array.isArray(responseData.data.products)) {
          productsData = responseData.data.products;
        } else if (Array.isArray(responseData.data)) {
          productsData = responseData.data;
        }
      }

      return productsData.map(transformProduct);
    } catch (error) {
      console.error('Error fetching products by location:', error);
      return [];
    }
  },

  // Become a client of a seller
  becomeClient: async (sellerId: string): Promise<any> => {
    try {
      // Use the buyers/sellers/... endpoint we created in buyer.routes.js
      const response = await publicApi.post(`buyers/sellers/${sellerId}/become-client`);
      return response.data;
    } catch (error: any) {
      console.error('Error becoming client:', error);
      throw error;
    }
  },

  // Poll payment status
  pollPaymentStatus: async (reference: string, maxAttempts: number = 30): Promise<any> => {
    let attempts = 0;
    const interval = 5000; // 5 seconds

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          attempts++;
          const response = await publicApi.get(`payments/status/${reference}`);
          const status = response.data.status?.toLowerCase();

          if (status === 'completed' || status === 'success' || status === 'failed' || status === 'cancelled') {
            resolve(response.data);
          } else if (attempts >= maxAttempts) {
            resolve({ status: 'timeout', message: 'Polling timed out' });
          } else {
            setTimeout(checkStatus, interval);
          }
        } catch (error) {
          console.error('[pollPaymentStatus] Error:', error);
          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(checkStatus, interval);
          }
        }
      };

      checkStatus();
    });
  }
};

export default publicApiService;
