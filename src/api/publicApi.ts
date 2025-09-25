import axios from 'axios';

type AxiosInstance = any;
type AxiosRequestConfig = any;
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';

// Extend the AxiosRequestConfig interface to include our custom options
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
}

// Define a type for our custom config
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

    // Add request interceptor to include auth token
    this.instance.interceptors.request.use(
      (config: any) => {
        // Skip auth if skipAuth flag is set
        if (config.skipAuth) {
          return config;
        }
        
        // Get token from localStorage (try buyer_token first, then fallback to token)
        let token = localStorage.getItem('buyer_token') || localStorage.getItem('token');
        
        // If token exists, add it to the Authorization header
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );
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
const publicApi = new CustomAxios();

interface ApiResponse<T> {
  data?: T;
  products?: T[];
  error?: string;
  status: number;
  statusText: string;
}

interface Product {
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

interface Seller {
  id: string;
  fullName: string;
  full_name?: string;
  email: string;
  phone: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  city?: string;
  website?: string;
  socialMedia?: Record<string, string>;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

// Helper function to transform product data from API
const transformProduct = (product: any): Product => {
  const transformedProduct: any = {
    ...product,
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
    createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
    updatedAt: seller.updated_at || seller.updatedAt,
    // Add any additional fields that might be present
    ...(seller.bio && { bio: seller.bio }),
    ...(seller.avatar_url && { avatarUrl: seller.avatar_url }),
    ...(seller.location && { location: seller.location }),
    ...(seller.website && { website: seller.website }),
    ...(seller.social_media && { socialMedia: seller.social_media })
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

  // Get all products with city and location filters
  getProducts: async (filters: { city: string; location?: string }): Promise<Product[]> => {
    try {
      console.log('Starting getProducts with filters:', filters);
      
      // First, find sellers in the specified city/location
      console.log('Searching for sellers with filters:', filters);
      const sellers = await publicApiService.searchSellers(filters);
      
      console.log(`Found ${sellers.length} sellers for city: ${filters.city}${filters.location ? `, location: ${filters.location}` : ''}`);
      
      if (sellers.length === 0) {
        console.log('No sellers found for the specified location');
        return [];
      }
      
      // Log seller information
      console.log('Sellers found:', sellers.map(seller => ({
        id: seller.id,
        name: seller.fullName,
        location: seller.location,
        city: seller.city
      })));
      
      // Create a map of sellerId to seller for quick lookup
      const sellerMap = sellers.reduce<Record<string, Seller>>((acc, seller) => {
        acc[seller.id] = seller;
        return acc;
      }, {});
      
      // Get unique seller IDs
      const sellerIds = Object.keys(sellerMap);
      
      console.log('Fetching products for sellers:', sellerIds);
      
      // Fetch products for these sellers
      const productsPromises = sellerIds.map(sellerId => 
        publicApi.get(`sellers/${sellerId}/products`).then(response => {
          console.log(`Received products for seller ${sellerId}:`, response.data);
          
          const responseData = response.data;
          let products: any[] = [];
          
          if (Array.isArray(responseData)) {
            products = responseData;
          } else if (responseData && 'data' in responseData && Array.isArray(responseData.data)) {
            products = responseData.data;
          } else if (responseData && 'products' in responseData && Array.isArray(responseData.products)) {
            products = responseData.products;
          }
          
          console.log(`Found ${products.length} products for seller ${sellerId}`);
          
          // Add seller info to each product
          const productsWithSeller = products.map(product => {
            const productWithSeller = {
              ...product,
              seller: sellerMap[sellerId]
            };
            
            console.log(`Product ${product.id} (${product.name}) has seller:`, {
              sellerId: sellerId,
              sellerName: sellerMap[sellerId]?.fullName,
              sellerLocation: sellerMap[sellerId]?.location
            });
            
            return productWithSeller;
          });
          
          return productsWithSeller;
        }).catch(error => {
          console.error(`Error fetching products for seller ${sellerId}:`, error);
          return []; // Return empty array if there's an error
        })
      );
      
      const productsArrays = await Promise.all(productsPromises);
      const productsData = productsArrays.flat();
      
      console.log(`Found ${productsData.length} products across ${sellers.length} sellers in ${filters.city}${filters.location ? `, ${filters.location}` : ''}`);
      
      // Log the first few products for debugging
      if (productsData.length > 0) {
        console.log('Sample products:', productsData.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          sellerId: p.sellerId,
          seller: p.seller ? {
            id: p.seller.id,
            name: p.seller.fullName,
            location: p.seller.location
          } : 'No seller info'
        })));
      }
      
      const transformedProducts = productsData.map(transformProduct);
      
      // Log transformed products
      console.log('Transformed products:', transformedProducts.map(p => ({
        id: p.id,
        name: p.name,
        sellerId: p.sellerId,
        hasSeller: !!p.seller,
        sellerLocation: p.seller?.location
      })));
      
      return transformedProducts;
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
      return [];
    }
  },

  // Get a single product by ID
  getProduct: async (id: string): Promise<Product | null> => {
    try {
      const response = await publicApi.get(`products/${id}`);
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
      // First try to get the seller info with authentication
      const token = localStorage.getItem('buyer_token') || localStorage.getItem('token');
      console.log('Auth token from localStorage:', token ? 'Found' : 'Not found');
      
      const response = await publicApi.get(`sellers/${sellerId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      console.log('Seller info response:', response.data);
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
      const response = await publicApi.get(`products/featured?limit=${limit}`);
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
      const response = await publicApi.get('products/search', {
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
      const response = await publicApi.get('products', {
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
  }
};

export default publicApiService;
