import { publicApi, SellerListResponse } from './instance';
import { transformSeller, ApiPublicSeller } from './sellerTransforms';

export async function getSellersPage(params: { page?: number; limit?: number } = {}): Promise<SellerListResponse> {
  try {
    const response = await publicApi.get('public/sellers/active', { params });
    let sellersData: unknown[] = [];
    const responseData = response.data as Record<string, unknown>;

    if (Array.isArray(responseData)) {
      sellersData = responseData;
    } else if (responseData && responseData.data && typeof responseData.data === 'object' && 'sellers' in responseData.data && Array.isArray((responseData.data as Record<string, unknown>).sellers)) {
      sellersData = (responseData.data as Record<string, unknown>).sellers as unknown[];
    } else if (responseData && 'sellers' in responseData && Array.isArray(responseData.sellers)) {
      sellersData = responseData.sellers as unknown[];
    }

    const paginationSource = responseData && 'pagination' in responseData
      ? (responseData.pagination as Record<string, unknown>)
      : (responseData && responseData.data && typeof responseData.data === 'object' && 'pagination' in responseData.data)
        ? ((responseData.data as Record<string, unknown>).pagination as Record<string, unknown>)
        : {};

    const sellers = sellersData.map(item => {
      const seller = transformSeller(item);
      if (seller) {
        const itemObj = item as Record<string, unknown>;
        return {
          ...seller,
          totalWishlistCount: Number(itemObj.totalWishlistCount || itemObj.total_wishlist_count || 0),
          wishlistCount: Number(itemObj.wishlistCount || itemObj.wishlist_count || itemObj.totalWishlistCount || itemObj.total_wishlist_count || 0),
          knockCount: Number(itemObj.knockCount || itemObj.knock_count || 0)
        } as ApiPublicSeller;
      }
      return null;
    }).filter((seller): seller is ApiPublicSeller => seller !== null);

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
}

export async function getSellers(): Promise<ApiPublicSeller[]> {
  const page = await getSellersPage({ page: 1, limit: 24 });
  return page.sellers;
}

export async function knockSeller(sellerId: string | number): Promise<{ sellerId: number; knockCount: number }> {
  const response = await publicApi.post(`public/sellers/${sellerId}/knock`);
  const responseData = response.data as Record<string, unknown>;
  return (responseData?.data as { sellerId: number; knockCount: number } | undefined) || { sellerId: Number(sellerId), knockCount: 0 };
}

export async function getSellerInfo(sellerId: string): Promise<ApiPublicSeller | null> {
  try {
    const response = await publicApi.get(`sellers/${sellerId}`);
    const responseData = response.data as Record<string, unknown>;
    const sellerData = responseData.seller || responseData;
    return sellerData ? transformSeller(sellerData) : null;
  } catch (error) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error('Error fetching seller info:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    return null;
  }
}


