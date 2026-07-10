import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Aesthetic, Seller, Product } from '@/types';
import { publicApiService } from '@/api/public';
import { ProductGridProps } from '@/types/components';
import { commonQueryKeys } from '@/api/queryKeys';

const transformProduct = (product: unknown): Product | null => {
  const pObj = product as Record<string, unknown>;
  if (!pObj.id || !pObj.name || pObj.price === undefined) {
    console.error('Product is missing required fields:', product);
    return null;
  }

  const transformedProduct: Product = {
    id: String(pObj.id || ''),
    name: String(pObj.name || 'Unnamed Product'),
    description: String(pObj.description || ''),
    price: Number(pObj.price) || 0,
    image_url: pObj.image_url || pObj.imageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80',
    sellerId: String(pObj.sellerId || pObj.seller_id || ''),
    isSold: Boolean(pObj.isSold || pObj.status === 'sold'),
    status: pObj.status || (pObj.isSold ? 'sold' : 'available'),
    soldAt: pObj.soldAt || pObj.sold_at || null,
    createdAt: pObj.createdAt || pObj.created_at || new Date().toISOString(),
    updatedAt: pObj.updatedAt || pObj.updated_at || new Date().toISOString(),
    aesthetic: (pObj.aesthetic || 'noir') as Aesthetic,
    is_digital: pObj.is_digital || pObj.isDigital,
    product_type: pObj.product_type || pObj.productType || 'physical',
    service_options: pObj.service_options || pObj.serviceOptions,
    service_locations: pObj.service_locations || pObj.serviceLocations,
  };

  if (pObj.seller) {
    const s = pObj.seller as Record<string, unknown>;
    transformedProduct.seller = {
      id: String(s.id || ''),
      fullName: s.fullName || s.full_name || 'Unknown Seller',
      email: s.email || '',
      phone: s.phone || '',
      shopName: s.shopName || s.shop_name || '',
      bannerUrl: s.bannerUrl || s.banner_url || s.bannerImage || s.banner_image || '',
      theme: s.theme || 'default',
      location: s.location || null,
      city: s.city || null,
      hasPhysicalShop: s.hasPhysicalShop || false,
      physicalAddress: s.physicalAddress || null,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
      createdAt: s.createdAt || s.created_at || new Date().toISOString(),
      updatedAt: s.updatedAt || s.updated_at,
      ...(s.bio && { bio: s.bio }),
      ...(s.avatarUrl && { avatarUrl: s.avatarUrl }),
      ...(s.website && { website: s.website }),
      ...(s.socialMedia && { socialMedia: s.socialMedia })
    } as Seller;
  }

  return transformedProduct;
};

export function usePublicProductsGrid({
  selectedAesthetic,
  searchQuery = '',
  locationCity,
  locationArea,
  priceMin,
  priceMax
}: ProductGridProps) {
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page: 1, limit: 50 };
    if (locationCity) {
      params.city = locationCity;
      if (locationArea) params.location = locationArea;
    }
    if (selectedAesthetic && selectedAesthetic !== 'all') {
      params.aesthetic = selectedAesthetic;
    }
    return params;
  }, [locationCity, locationArea, selectedAesthetic]);

  const productsQuery = useQuery({
    queryKey: commonQueryKeys.products(queryParams),
    queryFn: async () => {
      const result = await publicApiService.getProductsPage(queryParams);
      const transformedProducts = result.products
        .map(transformProduct)
        .filter((p): p is Product => p !== null);
      const sellersFromProducts = transformedProducts.reduce<Record<string, Seller>>((acc, product) => {
        if (product.seller) acc[product.seller.id] = product.seller;
        return acc;
      }, {});

      return {
        products: transformedProducts,
        sellers: sellersFromProducts,
        pagination: result.pagination
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData
  });

  const EMPTY_PRODUCTS: Product[] = [];
  const products = productsQuery.data?.products || EMPTY_PRODUCTS;
  const sellers = productsQuery.data?.sellers || {};
  const pagination = productsQuery.data?.pagination || { total: 0, page: 1, pageSize: 50, hasMore: false };
  const loading = productsQuery.isLoading;
  const error = productsQuery.isError ? 'Failed to load products. Please try again later.' : '';

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesPrice =
        (priceMin == null || product.price >= priceMin) &&
        (priceMax == null || product.price <= priceMax);

      const sellerLocationText = ((product.seller?.location ?? '') as string).toLowerCase();
      const locationAreaLower = (locationArea || '').toLowerCase().trim();
      const matchesArea = !locationAreaLower || sellerLocationText.includes(locationAreaLower);

      if (searchQuery.trim()) {
        const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
        const productText = `${product.name.toLowerCase()} ${product.description.toLowerCase()}`;
        const matchesSearch = searchTerms.every(term => productText.includes(term));

        return matchesPrice && matchesArea && matchesSearch;
      }

      return matchesPrice && matchesArea;
    });
  }, [products, priceMin, priceMax, locationArea, searchQuery]);

  return {
    error,
    filteredProducts,
    loading,
    pagination,
    sellers
  };
}


