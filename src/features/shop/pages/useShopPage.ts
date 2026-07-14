import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useSellerByShopNameQuery, usePublicSellerProductsQuery } from '@/hooks/public/useShopQueries';
import { useTrackCreatorLinkMutation } from '@/hooks/creator/mutations/useTrackCreatorLinkMutation';
import type { ApiSellerProduct } from '@/types/api/product';
import { useBuyerAuth } from '@/features/auth/contexts';
import { isNativeApp } from '@/lib/mobileApp';
import { useShopTheme, type Theme } from '@/hooks/useShopTheme';
import { isAesthetic, getSellerInitials, type ShopProduct, type ShopSeller } from './shopPage.shared';

export function useShopPage() {
  const { shopName } = useParams<{ shopName: string }>();
  const location = useLocation();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<ShopSeller | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  const { isAuthenticated } = useBuyerAuth();
  const themeClasses = useShopTheme((sellerInfo?.theme as Theme) || 'default');

  const trackCreatorLink = useTrackCreatorLinkMutation();

  useEffect(() => {
    const creatorCode = new URLSearchParams(location.search).get('creator');
    if (!creatorCode) return;

    const storageKey = `creator-click:${creatorCode}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
    trackCreatorLink.mutate(creatorCode);
  }, [location.search, trackCreatorLink]);

  const { data: seller, isLoading: isSellerLoading, error: sellerError } = useSellerByShopNameQuery(shopName || '', !!shopName);
  const { data: sellerProducts, isLoading: isProductsLoading } = usePublicSellerProductsQuery(seller?.id || '', !!seller?.id);

  useEffect(() => {
    if (sellerError) {
      const err = sellerError as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Failed to load shop data');
      setIsLoading(false);
      return;
    }

    if (isSellerLoading || (seller && isProductsLoading)) {
      setIsLoading(true);
      return;
    }

    if (!seller) {
      if (!isSellerLoading) {
        setError('Shop not found');
        setIsLoading(false);
      }
      return;
    }

    window.scrollTo(0, 0);

    const sellerData: ShopSeller = {
      id: String(seller.id),
      fullName: seller.fullName || seller.full_name || '',
      shopName: seller.shopName || seller.shop_name || '',
      phone: seller.phone || '',
      whatsappNumber: seller.whatsappNumber || seller.phone || '',
      email: seller.email || '',
      bannerImage: seller.bannerImage || seller.banner_image || '',
      city: seller.city,
      location: seller.location,
      theme: (seller.theme as Theme) || 'default',
      instagramLink: seller.instagramLink || '',
      tiktokLink: seller.tiktokLink || '',
      facebookLink: seller.facebookLink || '',
      clientCount: seller.clientCount || seller.client_count || 0,
      bio: seller.bio || '',
      avatarUrl: seller.avatarUrl || seller.avatar_url || '',
      hasPhysicalShop: !!seller.physicalAddress,
      physicalAddress: seller.physicalAddress,
      latitude: seller.latitude,
      longitude: seller.longitude,
      createdAt: seller.createdAt || new Date().toISOString()
    };

    setSellerInfo(sellerData);
    setAvatarLoadFailed(false);
    setBannerLoadFailed(false);

    if (sellerProducts) {
      const availableProducts = (sellerProducts as ApiSellerProduct[])
        .map(p => ({
          ...p,
          sellerId: p.sellerId || '',
          isSold: p.isSold || false,
          status: p.status || 'available',
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
          aesthetic: isAesthetic((p as unknown as Record<string, unknown>).aesthetic as string) ? ((p as unknown as Record<string, unknown>).aesthetic as import("@/types").Aesthetic) : 'all',
          seller: sellerData
        } as unknown as ShopProduct))
        .filter(p => !p.isSold && p.status !== 'sold');

      setProducts(availableProducts);
    }

    setIsLoading(false);
  }, [seller, sellerProducts, isSellerLoading, isProductsLoading, sellerError, shopName]);

  // Digital products are hidden inside the native app: Google Play requires
  // digital goods to be sold via Play Billing, so they stay web-only.
  const visibleProducts = isNativeApp()
    ? products.filter(product => {
        const p = product as { productType?: string; isDigital?: boolean };
        return p.productType !== 'digital' && !p.isDigital;
      })
    : products;

  // Filter products based on search query
  const filteredProducts = visibleProducts.filter(product => {
    if (!searchQuery.trim()) return true;

    const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
    const productText = `${product.name.toLowerCase()} ${product.description.toLowerCase()}`;

    return searchTerms.every(term =>
      productText.includes(term)
    );
  });

  const sellerInitials = getSellerInitials(sellerInfo?.shopName, sellerInfo?.fullName);
  const showSellerAvatar = Boolean(sellerInfo?.avatarUrl && !avatarLoadFailed);


  return {
    sellerInfo,
    themeClasses,
    products: visibleProducts,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    bannerLoadFailed,
    setBannerLoadFailed,
    avatarLoadFailed,
    setAvatarLoadFailed,
    sellerInitials,
    showSellerAvatar,
    isLoading,
    error,
    isAuthenticated,
  };
}
