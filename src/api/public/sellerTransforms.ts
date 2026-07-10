import type { ApiPublicSeller } from '@/types/api/seller';
export type { ApiPublicSeller };


export function transformSeller(seller: unknown): ApiPublicSeller | null {
  if (!seller) return null;
  const sObj = seller as Record<string, unknown>;
  const str = (v: unknown, fallback = ''): string => (v === null || v === undefined || v === '') ? fallback : String(v);
  return {
    id: str(sObj.id),
    fullName: str(sObj.full_name || sObj.fullName, 'Unknown Seller'),
    email: str(sObj.email),
    phone: str(sObj.phone),
    bannerUrl: str(sObj.banner_url || sObj.bannerUrl),
    shopName: str(sObj.shop_name || sObj.shopName, 'My Shop'),
    createdAt: str(sObj.created_at || sObj.createdAt, new Date().toISOString()),
    updatedAt: str(sObj.updated_at || sObj.updatedAt, new Date().toISOString()),
    theme: str(sObj.theme, 'default'),
    ...(sObj.bio ? { bio: str(sObj.bio) } : {}),
    ...(sObj.avatar_url ? { avatarUrl: str(sObj.avatar_url) } : {}),
    ...(sObj.avatarUrl ? { avatarUrl: str(sObj.avatarUrl) } : {}),
    ...(sObj.location ? { location: str(sObj.location) } : {}),
    ...(sObj.city ? { city: str(sObj.city) } : {}),
    ...(sObj.website ? { website: str(sObj.website) } : {}),
    ...(sObj.social_media ? { socialMedia: sObj.social_media as Record<string, string> } : {}),
    ...(sObj.socialMedia ? { socialMedia: sObj.socialMedia as Record<string, string> } : {}),
    hasPhysicalShop: Boolean(sObj.hasPhysicalShop || sObj.has_physical_shop || sObj.physicalAddress || sObj.physical_address),
    ...(sObj.physicalAddress ? { physicalAddress: str(sObj.physicalAddress) } : {}),
    ...(sObj.physical_address ? { physicalAddress: str(sObj.physical_address) } : {}),
    ...(sObj.latitude ? { latitude: Number(sObj.latitude) } : {}),
    ...(sObj.longitude ? { longitude: Number(sObj.longitude) } : {}),
    ...(sObj.clientCount !== undefined ? { clientCount: Number(sObj.clientCount) } : {}),
    ...(sObj.client_count !== undefined ? { clientCount: Number(sObj.client_count) } : {}),
    ...(sObj.totalWishlistCount !== undefined ? { totalWishlistCount: Number(sObj.totalWishlistCount) } : {}),
    ...(sObj.total_wishlist_count !== undefined ? { totalWishlistCount: Number(sObj.total_wishlist_count) } : {}),
    ...(sObj.wishlistCount !== undefined ? { wishlistCount: Number(sObj.wishlistCount) } : {}),
    ...(sObj.wishlist_count !== undefined ? { wishlistCount: Number(sObj.wishlist_count) } : {}),
    ...(sObj.knockCount !== undefined ? { knockCount: Number(sObj.knockCount) } : {}),
    ...(sObj.knock_count !== undefined ? { knockCount: Number(sObj.knock_count) } : {})
  };
}


