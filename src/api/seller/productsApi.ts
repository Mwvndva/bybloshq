import apiClient from '@/lib/apiClient';
import type { Product } from './types';

const sellerApiInstance = apiClient;

export const transformProduct = (product: any): Product => {
  let price = 0;
  if (product.price !== null && product.price !== undefined) {
    if (typeof product.price === 'number') {
      price = product.price;
    } else if (typeof product.price === 'string') {
      const parsed = parseFloat(product.price);
      price = isNaN(parsed) ? 0 : parsed;
    } else if (typeof product.price === 'object') {
      const numericValue = product.price.value || product.price.amount || product.price.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  return {
    ...product,
    price,
    image_url: product.image_url || product.imageUrl,
    sellerId: product.sellerId || product.seller_id,
    createdAt: product.createdAt || product.created_at,
    updatedAt: product.updatedAt || product.updated_at,
    isSold: product.isSold || product.is_sold || product.status === 'sold',
    status: product.status || (product.isSold || product.is_sold ? 'sold' : 'available')
  };
};

interface ProductsResponse {
  data: {
    products: any[];
  };
}

interface ProductResponse {
  data: any;
}

export const sellerProductsApi = {
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

  getSellerProducts: async (sellerId: string | number): Promise<Product[]> => {
    try {
      const response = await apiClient.get<ProductsResponse>(`/sellers/${sellerId}/products`);
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

  async uploadDigitalProduct(file: File, onProgress?: (progress: number) => void): Promise<{ filePath: string; fileName: string; size: number }> {
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
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 5 * 60 * 1000,
    } as any);

    return {
      filePath: response.data.data.filePath,
      fileName: response.data.data.fileName,
      size: response.data.data.size
    };
  }
};
