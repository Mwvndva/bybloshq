import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Aesthetic, Seller, Product } from '@/types';
import { publicApiService } from '@/api/publicApi';
import { ProductGridProps } from '@/types/components';

const transformProduct = (product: any): Product | null => {
  if (!product.id || !product.name || product.price === undefined) {
    console.error('Product is missing required fields:', product);
    return null;
  }

  const transformedProduct: any = {
    id: String(product.id || ''),
    name: String(product.name || 'Unnamed Product'),
    description: String(product.description || ''),
    price: Number(product.price) || 0,
    image_url: product.image_url || product.imageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80',
    sellerId: String(product.sellerId || product.seller_id || ''),
    isSold: Boolean(product.isSold || product.status === 'sold'),
    status: product.status || (product.isSold ? 'sold' : 'available'),
    soldAt: product.soldAt || product.sold_at || null,
    createdAt: product.createdAt || product.created_at || new Date().toISOString(),
    updatedAt: product.updatedAt || product.updated_at || new Date().toISOString(),
    aesthetic: (product.aesthetic || 'noir') as Aesthetic,
    is_digital: product.is_digital || product.isDigital,
    product_type: product.product_type || product.productType || 'physical',
    service_options: product.service_options || product.serviceOptions,
    service_locations: product.service_locations || product.serviceLocations,
  };

  if (product.seller) {
    transformedProduct.seller = {
      id: String(product.seller.id || ''),
      fullName: product.seller.fullName || product.seller.full_name || 'Unknown Seller',
      email: product.seller.email || '',
      phone: product.seller.phone || '',
      shopName: product.seller.shopName || product.seller.shop_name || '',
      bannerUrl: product.seller.bannerUrl || product.seller.banner_url || product.seller.bannerImage || product.seller.banner_image || '',
      theme: product.seller.theme || 'default',
      location: product.seller.location || null,
      city: product.seller.city || null,
      hasPhysicalShop: product.seller.hasPhysicalShop || false,
      physicalAddress: product.seller.physicalAddress || null,
      latitude: product.seller.latitude || null,
      longitude: product.seller.longitude || null,
      createdAt: product.seller.createdAt || product.seller.created_at || new Date().toISOString(),
      updatedAt: product.seller.updatedAt || product.seller.updated_at,
      ...(product.seller.bio && { bio: product.seller.bio }),
      ...(product.seller.avatarUrl && { avatarUrl: product.seller.avatarUrl }),
      ...(product.seller.website && { website: product.seller.website }),
      ...(product.seller.socialMedia && { socialMedia: product.seller.socialMedia })
    };
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
    const params: any = { page: 1, limit: 50 };
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
    queryKey: ['public-products', queryParams],
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

  const products = productsQuery.data?.products || [];
  const sellers = productsQuery.data?.sellers || {};
  const pagination = productsQuery.data?.pagination || { total: 0, page: 1, pageSize: 50, hasMore: false };
  const loading = productsQuery.isLoading;
  const error = productsQuery.isError ? 'Failed to load products. Please try again later.' : '';

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesPrice =
        (priceMin == null || product.price >= priceMin) &&
        (priceMax == null || product.price <= priceMax);

      const sellerLocationText = (product.seller?.location || '').toLowerCase();
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
