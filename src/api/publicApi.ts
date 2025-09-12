import axios from 'axios';

// Use VITE_API_URL from environment variables or fallback to relative path for development
let baseURL = import.meta.env.VITE_API_URL || '/api';

// Ensure baseURL ends with /api
if (!baseURL.endsWith('/api')) {
  baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
}

console.log('API Base URL:', baseURL); // Debug log

const publicApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies if using sessions
});

interface Product {
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
}

interface Seller {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
}

// Helper function to transform product data from API
const transformProduct = (product: any): Product => ({
  ...product,
  image_url: product.image_url || product.imageUrl,
  sellerId: product.sellerId || product.seller_id,
  isSold: product.isSold || product.is_sold || product.status === 'sold',
  status: product.status || (product.isSold || product.is_sold ? 'sold' : 'available'),
  createdAt: product.createdAt || product.created_at,
  updatedAt: product.updatedAt || product.updated_at,
  soldAt: product.soldAt || product.sold_at
});

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
  // Get all products (optionally filtered by aesthetic)
  getProducts: async (aesthetic?: string): Promise<Product[]> => {
    try {
      // Remove leading slash to ensure it's relative to baseURL
      const endpoint = aesthetic 
        ? `products?aesthetic=${encodeURIComponent(aesthetic)}` 
        : 'products';
      const url = endpoint;
      
      console.log('Fetching products from URL:', url);
      const response = await publicApi.get(url);
      
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data ? 'Received data' : 'No data',
        dataStructure: Object.keys(response.data || {})
      });
      
      // Handle response structure
      const productsData = response.data.data?.products || response.data.products || response.data || [];
      
      console.log('Extracted products data:', {
        hasData: !!productsData,
        isArray: Array.isArray(productsData),
        itemCount: Array.isArray(productsData) ? productsData.length : 'N/A',
        firstItem: Array.isArray(productsData) && productsData[0] ? 
          { id: productsData[0].id, name: productsData[0].name } : 'N/A'
      });
      
      // Transform products
      const transformedProducts = productsData.map(transformProduct);
      console.log('Transformed products:', transformedProducts);
      
      return transformedProducts;
    } catch (error: any) {
      console.error('Error fetching products:', {
        message: error.message,
        code: error.code,
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
      const productData = response.data.data?.product || response.data.product || response.data;
      return transformProduct(productData);
    } catch (error) {
      console.error(`Error fetching product ${id}:`, error);
      console.error('Error details:', error.response?.data || error.message);
      return null;
    }
  },

  // Get seller public info
  getSellerInfo: async (sellerId: string): Promise<Seller | null> => {
    try {
      const response = await publicApi.get(`sellers/${sellerId}/public`);
      const sellerData = response.data.data?.seller || response.data.seller || response.data;
      return transformSeller(sellerData);
    } catch (error) {
      console.error(`Error fetching seller ${sellerId}:`, error);
      console.error('Error details:', error.response?.data || error.message);
      return null;
    }
  },

  // Get featured products
  getFeaturedProducts: async (limit: number = 8): Promise<Product[]> => {
    try {
      const response = await publicApi.get('products/featured', {
        params: { limit }
      });
      const productsData = response.data.products || response.data.data?.products || response.data || [];
      return productsData.map(transformProduct);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      return [];
    }
  },

  // Search products
  searchProducts: async (query: string, filters: Record<string, any> = {}): Promise<Product[]> => {
    try {
      const params = { q: query, ...filters };
      const response = await publicApi.get('products/search', { params });
      const productsData = response.data.products || response.data.data?.products || response.data || [];
      return productsData.map(transformProduct);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }
};

export default publicApiService;
