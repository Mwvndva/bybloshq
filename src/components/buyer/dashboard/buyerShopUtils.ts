export const getShopId = (shop: any) => String(shop?.id || shop?.sellerId || shop?.seller_id || '');

export const updateSellerClientCount = (seller: any, clientCount: number) => ({
  ...seller,
  clientCount,
  client_count: clientCount
});

export const updateSellerClickCount = (seller: any, clickCount: number) => ({
  ...seller,
  knockCount: clickCount,
  knock_count: clickCount
});

export const hasValidShopCoordinate = (shop: any) => {
  const lat = Number(shop?.latitude);
  const lng = Number(shop?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
};

export const isPhysicalShop = (shop: any) => Boolean(
  shop?.hasPhysicalShop ||
  shop?.has_physical_shop ||
  shop?.physicalAddress ||
  shop?.physical_address ||
  hasValidShopCoordinate(shop)
);
