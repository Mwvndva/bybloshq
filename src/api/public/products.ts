import { publicApi, ProductListResponse } from './instance';
import { transformProduct, ApiProduct } from './productTransforms';

export async function getProductsPage(filters: { city?: string; location?: string; aesthetic?: string; page?: number; limit?: number } = {}): Promise<ProductListResponse> {
  try {
    console.log('Starting getProducts with filters:', filters);
    const response = await publicApi.get('public/products', { params: filters });
    const responseData = response.data as Record<string, unknown>;
    let productsData: unknown[] = [];

    if (Array.isArray(responseData)) {
      productsData = responseData;
    } else if (responseData && Array.isArray(responseData.data)) {
      productsData = responseData.data;
    } else if (responseData && responseData.data && typeof responseData.data === 'object' && 'products' in responseData.data && Array.isArray((responseData.data as Record<string, unknown>).products)) {
      productsData = (responseData.data as Record<string, unknown>).products as unknown[];
    } else if (responseData && 'products' in responseData && Array.isArray(responseData.products)) {
      productsData = responseData.products as unknown[];
    }

    const pagination = responseData && 'pagination' in responseData
      ? (responseData.pagination as Record<string, unknown>)
      : (responseData && responseData.data && typeof responseData.data === 'object' && 'pagination' in responseData.data)
        ? ((responseData.data as Record<string, unknown>).pagination as Record<string, unknown>)
        : {
            total: 0,
            page: filters.page || 1,
            pageSize: filters.limit || productsData.length,
            hasMore: false
          };

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
  } catch (error) {
    const err = error as { message?: string; response?: { status?: number; statusText?: string; data?: unknown }; stack?: string };
    console.error('Error fetching products:', {
      message: err.message,
      response: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      } : 'No response',
      stack: err.stack
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
}

export async function getProducts(filters: { city?: string; location?: string; aesthetic?: string; page?: number; limit?: number } = {}): Promise<ApiProduct[]> {
  const result = await getProductsPage(filters);
  return result.products;
}

export async function getProduct(id: string): Promise<ApiProduct | null> {
  try {
    const response = await publicApi.get(`public/products/${id}`);
    const responseData = response.data as Record<string, unknown>;
    const productData = responseData.product || responseData;
    return productData ? transformProduct(productData) : null;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function getFeaturedProducts(limit: number = 8): Promise<ApiProduct[]> {
  try {
    const response = await publicApi.get(`public/products/featured?limit=${limit}`);
    let productsData: unknown[] = [];
    const responseData = response.data as Record<string, unknown>;

    if (Array.isArray(responseData)) {
      productsData = responseData;
    } else if (responseData && 'products' in responseData && Array.isArray(responseData.products)) {
      productsData = responseData.products as unknown[];
    } else if (responseData && 'data' in responseData && responseData.data && typeof responseData.data === 'object' && 'products' in responseData.data && Array.isArray((responseData.data as Record<string, unknown>).products)) {
      productsData = (responseData.data as Record<string, unknown>).products as unknown[];
    } else if (responseData && 'data' in responseData && Array.isArray(responseData.data)) {
      productsData = responseData.data as unknown[];
    }

    return productsData.map(transformProduct);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return [];
  }
}

export async function getProductsByLocation(location: string): Promise<ApiProduct[]> {
  try {
    const response = await publicApi.get('public/products', {
      params: { location }
    });

    let productsData: unknown[] = [];
    const responseData = response.data as Record<string, unknown>;

    if (Array.isArray(responseData)) {
      productsData = responseData;
    } else if (responseData && 'products' in responseData && Array.isArray(responseData.products)) {
      productsData = responseData.products as unknown[];
    } else if (responseData && 'data' in responseData && responseData.data && typeof responseData.data === 'object' && 'products' in responseData.data && Array.isArray((responseData.data as Record<string, unknown>).products)) {
      productsData = (responseData.data as Record<string, unknown>).products as unknown[];
    } else if (responseData && 'data' in responseData && Array.isArray(responseData.data)) {
      productsData = responseData.data as unknown[];
    }

    return productsData.map(transformProduct);
  } catch (error) {
    console.error('Error fetching products by location:', error);
    return [];
  }
}


