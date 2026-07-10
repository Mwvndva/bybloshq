import type { ApiPublicSeller } from '@/types/api/seller';

export const getShopId = (shop: ApiPublicSeller) => String(shop?.id || shop?.sellerId || shop?.seller_id || '');

export const updateSellerClientCount = (seller: ApiPublicSeller, clientCount: number) => ({
  ...seller,
  clientCount,
  client_count: clientCount
});

export const updateSellerClickCount = (seller: ApiPublicSeller, clickCount: number) => ({
  ...seller,
  knockCount: clickCount,
  knock_count: clickCount
});

export const hasValidShopCoordinate = (shop: ApiPublicSeller) => {
  const lat = Number(shop?.latitude);
  const lng = Number(shop?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

export const isPhysicalShop = (shop: ApiPublicSeller) => Boolean(
  shop?.hasPhysicalShop ||
  shop?.has_physical_shop ||
  shop?.physicalAddress ||
  shop?.physical_address ||
  hasValidShopCoordinate(shop)
);


