import { buyerApiInstance, ApiError } from './instance';

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
  product_type?: 'physical' | 'digital' | 'service';
  is_digital?: boolean;
  service_options?: unknown;
  service_locations?: string;
  images?: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  status?: string;
}

export async function getWishlist(maxRetries = 2, retryCount = 0): Promise<WishlistItem[]> {
  try {
    const response = await buyerApiInstance.get<ApiResponse<{ items: WishlistItem[] }>>('/buyers/wishlist', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      timeout: 15000
    });

    const isSuccess = response.data?.success || response.data?.status === 'success';
    if (!isSuccess || !response.data.data?.items) {
      throw new Error('Invalid response format from server');
    }

    const items = Array.isArray(response.data.data.items) ? response.data.data.items : [];
    return items;

  } catch (error) {
    const err = error as ApiError;
    if ((err.code === 'ECONNABORTED' || err.message.includes('timeout')) && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return getWishlist(maxRetries, retryCount + 1);
    }

    return [];
  }
}

export async function addToWishlist(product: { id: string }): Promise<boolean> {
  try {
    const response = await buyerApiInstance.post<ApiResponse<unknown>>(
      '/buyers/wishlist',
      { productId: product.id }
    );

    const isSuccess = response.data?.success || response.data?.status === 'success';
    if (isSuccess) {
      return true;
    }

    return false;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.status === 409) {
      const errorMessage = (err.response?.data as Record<string, unknown> | undefined)?.message || 'Product already in wishlist';
      const typedErr = new Error(String(errorMessage)) as Error & { code?: string };
      typedErr.code = 'DUPLICATE_WISHLIST_ITEM';
      throw typedErr;
    }

    return false;
  }
}

export async function removeFromWishlist(productId: string): Promise<boolean> {
  try {
    const response = await buyerApiInstance.delete<ApiResponse<void>>(
      `/buyers/wishlist/${productId}`
    );

    const isSuccess = response.data?.success || response.data?.status === 'success';
    if (isSuccess) {
      return true;
    }

    return false;
  } catch (error) {
    const err = error as ApiError;
    if (err.response?.status === 404) {
      return true;
    }

    return false;
  }
}

export async function syncWishlist(items: WishlistItem[]): Promise<boolean> {
  try {
    await buyerApiInstance.put<ApiResponse<void>>(
      '/buyers/wishlist/sync',
      { items }
    );
    return true;
  } catch (error) {
    const err = error as ApiError;
    return false;
  }
}

