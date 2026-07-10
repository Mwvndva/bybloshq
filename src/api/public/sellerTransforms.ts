import type { ApiPublicSeller } from '@/types/api/seller';
export type { ApiPublicSeller };


export function transformSeller(seller: unknown): ApiPublicSeller | null {
  const sObj = seller as Record<string, unknown>;
  if (!seller) return null;
  return {
    id: sObj.id,
    fullName: sObj.full_name || sObj.fullName || 'Unknown Seller',
    email: sObj.email || '',
    phone: sObj.phone || '',
    bannerUrl: sObj.banner_url || sObj.bannerUrl || '',
    shopName: sObj.shop_name || sObj.shopName || 'My Shop',
    createdAt: sObj.created_at || sObj.createdAt || new Date().toISOString(),
    updatedAt: sObj.updated_at || sObj.updatedAt || new Date().toISOString(),
    theme: sObj.theme || 'default',
    ...(sObj.bio && { bio: sObj.bio }),
    ...(sObj.avatar_url && { avatarUrl: sObj.avatar_url }),
    ...(sObj.avatarUrl && { avatarUrl: sObj.avatarUrl }),
    ...(sObj.location && { location: sObj.location }),
    ...(sObj.city && { city: sObj.city }),
    ...(sObj.website && { website: sObj.website }),
    ...(sObj.social_media && { socialMedia: sObj.social_media }),
    ...(sObj.socialMedia && { socialMedia: sObj.socialMedia }),
    hasPhysicalShop: sObj.hasPhysicalShop || sObj.has_physical_shop || !!sObj.physicalAddress || !!sObj.physical_address,
    ...(sObj.physicalAddress && { physicalAddress: sObj.physicalAddress }),
    ...(sObj.physical_address && { physicalAddress: sObj.physical_address }),
    ...(sObj.latitude && { latitude: sObj.latitude }),
    ...(sObj.longitude && { longitude: sObj.longitude }),
    ...(sObj.clientCount !== undefined && { clientCount: Number(sObj.clientCount) }),
    ...(sObj.client_count !== undefined && { clientCount: Number(sObj.client_count) }),
    ...(sObj.totalWishlistCount !== undefined && { totalWishlistCount: Number(sObj.totalWishlistCount) }),
    ...(sObj.total_wishlist_count !== undefined && { totalWishlistCount: Number(sObj.total_wishlist_count) }),
    ...(sObj.wishlistCount !== undefined && { wishlistCount: Number(sObj.wishlistCount) }),
    ...(sObj.wishlist_count !== undefined && { wishlistCount: Number(sObj.wishlist_count) }),
    ...(sObj.knockCount !== undefined && { knockCount: Number(sObj.knockCount) }),
    ...(sObj.knock_count !== undefined && { knockCount: Number(sObj.knock_count) })
  };
}


