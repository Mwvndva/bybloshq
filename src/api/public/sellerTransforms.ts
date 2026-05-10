export interface Seller {
  id: string;
  fullName: string;
  full_name?: string;
  email: string;
  phone: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  banner_url?: string;
  theme?: string;
  location?: string;
  city?: string;
  website?: string;
  socialMedia?: Record<string, string>;
  shopName?: string;
  shop_name?: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  hasPhysicalShop?: boolean;
  has_physical_shop?: boolean;
  physicalAddress?: string;
  physical_address?: string;
  latitude?: number;
  longitude?: number;
  totalWishlistCount?: number;
  wishlistCount?: number;
  clientCount?: number;
  client_count?: number;
  knockCount?: number;
  knock_count?: number;
}

export function transformSeller(seller: any): Seller | null {
  if (!seller) return null;
  return {
    id: seller.id,
    fullName: seller.full_name || seller.fullName || 'Unknown Seller',
    email: seller.email || '',
    phone: seller.phone || '',
    bannerUrl: seller.banner_url || seller.bannerUrl || '',
    shopName: seller.shop_name || seller.shopName || 'My Shop',
    createdAt: seller.created_at || seller.createdAt || new Date().toISOString(),
    updatedAt: seller.updated_at || seller.updatedAt || new Date().toISOString(),
    theme: seller.theme || 'default',
    ...(seller.bio && { bio: seller.bio }),
    ...(seller.avatar_url && { avatarUrl: seller.avatar_url }),
    ...(seller.avatarUrl && { avatarUrl: seller.avatarUrl }),
    ...(seller.location && { location: seller.location }),
    ...(seller.city && { city: seller.city }),
    ...(seller.website && { website: seller.website }),
    ...(seller.social_media && { socialMedia: seller.social_media }),
    ...(seller.socialMedia && { socialMedia: seller.socialMedia }),
    hasPhysicalShop: seller.hasPhysicalShop || seller.has_physical_shop || !!seller.physicalAddress || !!seller.physical_address,
    ...(seller.physicalAddress && { physicalAddress: seller.physicalAddress }),
    ...(seller.physical_address && { physicalAddress: seller.physical_address }),
    ...(seller.latitude && { latitude: seller.latitude }),
    ...(seller.longitude && { longitude: seller.longitude }),
    ...(seller.clientCount !== undefined && { clientCount: Number(seller.clientCount) }),
    ...(seller.client_count !== undefined && { clientCount: Number(seller.client_count) }),
    ...(seller.totalWishlistCount !== undefined && { totalWishlistCount: Number(seller.totalWishlistCount) }),
    ...(seller.total_wishlist_count !== undefined && { totalWishlistCount: Number(seller.total_wishlist_count) }),
    ...(seller.wishlistCount !== undefined && { wishlistCount: Number(seller.wishlistCount) }),
    ...(seller.wishlist_count !== undefined && { wishlistCount: Number(seller.wishlist_count) }),
    ...(seller.knockCount !== undefined && { knockCount: Number(seller.knockCount) }),
    ...(seller.knock_count !== undefined && { knockCount: Number(seller.knock_count) })
  };
}
