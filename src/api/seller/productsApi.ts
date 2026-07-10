import apiClient from '@/lib/apiClient';
import type { ApiSellerProduct } from '@/types/api/product';

const sellerApiInstance = apiClient;

export const transformProduct = (product: unknown): ApiSellerProduct => {
  const pObj = product as Record<string, unknown>;
  let price = 0;
  if (pObj.price !== null && pObj.price !== undefined) {
    if (typeof pObj.price === 'number') {
      price = pObj.price;
    } else if (typeof pObj.price === 'string') {
      const parsed = parseFloat(pObj.price);
      price = isNaN(parsed) ? 0 : parsed;
    } else if (typeof pObj.price === 'object') {
      const priceObj = pObj.price as Record<string, unknown>;
      const numericValue = priceObj.value || priceObj.amount || priceObj.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  const transformed: Record<string, unknown> = {
    ...pObj,
    price,
    image_url: pObj.image_url || pObj.imageUrl,
    sellerId: pObj.sellerId || pObj.seller_id,
    createdAt: pObj.createdAt || pObj.created_at,
    updatedAt: pObj.updatedAt || pObj.updated_at,
    is_custom_product: Boolean(pObj.is_custom_product || pObj.isCustomProduct),
    production_days: pObj.production_days ?? pObj.productionDays ?? null,
    customization_prompt: pObj.customization_prompt || pObj.customizationPrompt || null,
    is_imported_product: Boolean(pObj.is_imported_product || pObj.isImportedProduct),
    import_days: pObj.import_days ?? pObj.importDays ?? null,
    import_note: pObj.import_note || pObj.importNote || null,
    isSold: pObj.isSold || pObj.is_sold || pObj.status === 'sold',
    status: pObj.status || (pObj.isSold || pObj.is_sold ? 'sold' : 'available')
  };
  return transformed as unknown as ApiSellerProduct;
};

interface ProductsResponse {
  data: {
    products: ApiSellerProduct[];
  };
}

interface ProductResponse {
  data: unknown;
}

export const sellerProductsApi = {
  createProduct: async (product: Omit<ApiSellerProduct, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isSold'>): Promise<ApiSellerProduct> => {
    const response = await sellerApiInstance.post('/sellers/products', product);
    return transformProduct(response.data);
  },

  getProducts: async (): Promise<ApiSellerProduct[]> => {
    try {
      const response = await sellerApiInstance.get<ProductsResponse>('/sellers/products');
      const products = response.data?.data?.products || [];
      return products.map(transformProduct);
    } catch (error) {
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

  getSellerProducts: async (sellerId: string | number): Promise<ApiSellerProduct[]> => {
    try {
      const response = await apiClient.get<ProductsResponse>(`/sellers/${sellerId}/products`);
      let products: ApiSellerProduct[] = [];
      if (response.data?.data?.products) {
        products = response.data.data.products;
      } else if (Array.isArray(response.data?.data)) {
        products = response.data.data;
      } else if (Array.isArray(response.data)) {
        products = response.data;
      }
      return products.map(transformProduct);
    } catch (error) {
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

  getProduct: async (id: string): Promise<ApiSellerProduct> => {
    try {
      const response = await sellerApiInstance.get<ProductResponse>(`/sellers/products/${id}`);
      const productData = (response.data?.data as Record<string, unknown>)?.product;
      if (!productData) {
        throw new Error('ApiSellerProduct not found');
      }
      return transformProduct(productData);
    } catch (error) {
      console.error('Error fetching product:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  updateProduct: async (id: string, updates: Partial<ApiSellerProduct>): Promise<ApiSellerProduct> => {
    const response = await sellerApiInstance.patch(`/sellers/products/${id}`, updates);
    return transformProduct(response.data);
  },

  updateInventory: async (id: string, inventoryData: {
    track_inventory: boolean;
    quantity: number | null;
    low_stock_threshold: number | null;
  }): Promise<ApiSellerProduct> => {
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
    } as import('axios').AxiosRequestConfig);

    return {
      filePath: response.data.data.filePath,
      fileName: response.data.data.fileName,
      size: response.data.data.size
    };
  }
};


