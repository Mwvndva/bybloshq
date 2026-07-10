import { publicApi } from './instance';
import { transformSeller, ApiPublicSeller } from './sellerTransforms';
import { transformProduct, ApiProduct } from './productTransforms';

export async function searchSellers(filters: { city: string; location?: string }): Promise<ApiPublicSeller[]> {
  try {
    const params = new URLSearchParams();
    params.append('city', filters.city);

    if (filters.location) {
      params.append('location', filters.location);
    }

    console.log('Searching for sellers with params:', { city: filters.city, location: filters.location });

    const response = await publicApi.get(`sellers/search?${params.toString()}`);

    let sellersData: unknown[] = [];
    const responseData = response.data;

    if (Array.isArray(responseData)) {
      sellersData = responseData;
    } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray((responseData as Record<string, unknown>).data)) {
      sellersData = (responseData as Record<string, unknown>).data as unknown[];
    } else if (responseData && typeof responseData === 'object' && 'sellers' in responseData && Array.isArray((responseData as Record<string, unknown>).sellers)) {
      sellersData = (responseData as Record<string, unknown>).sellers as unknown[];
    }

    console.log(`Found ${sellersData.length} sellers for city: ${filters.city}${filters.location ? `, location: ${filters.location}` : ''}`);

    return sellersData.map(transformSeller).filter((seller): seller is ApiPublicSeller => seller !== null);
  } catch (error) {
    const err = error as { message?: string; response?: { status?: number; statusText?: string; data?: unknown }; stack?: string };
    console.error('Error searching for sellers:', {
      message: err.message,
      response: err.response ? {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      } : 'No response',
      stack: err.stack
    });
    return [];
  }
}

export async function searchProducts(query: string, filters: Record<string, unknown> = {}): Promise<ApiProduct[]> {
  try {
    const response = await publicApi.get('public/products/search', {
      params: { q: query, ...filters }
    });

    let productsData: ApiProduct[] = [];
    const responseData = response.data;

    if (Array.isArray(responseData)) {
      productsData = responseData;
    } else if (responseData && typeof responseData === 'object' && 'products' in responseData) {
      const prods = (responseData as Record<string, unknown>).products;
      productsData = Array.isArray(prods) ? prods : [];
    } else if (responseData && typeof responseData === 'object' && 'data' in responseData && (responseData as Record<string, unknown>).data) {
      const dataObj = (responseData as Record<string, unknown>).data as Record<string, unknown>;
      if (Array.isArray(dataObj.products)) {
        productsData = dataObj.products;
      } else if (Array.isArray(dataObj)) {
        productsData = dataObj;
      }
    }

    return productsData.map(transformProduct);
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}


