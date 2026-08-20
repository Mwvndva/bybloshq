import type { Theme } from '../primitives';

// Seller schema returned by the public-facing API
export interface ApiPublicSeller {
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

// Seller schema returned by the seller portal API
export interface ApiSeller {
  id: number;
  fullName: string;
  full_name?: string;
  shopName: string;
  shop_name?: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  hasPhysicalShop?: boolean;
  physicalAddress?: string;
  physical_address?: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  banner_image?: string;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
  theme?: 'default' | 'black' | 'pink' | 'purple' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';
  balance?: number;
  total_sales?: number;
  totalSales?: number;
  net_revenue?: number;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  creatorCommissionRate?: number;
  creator_commission_rate?: number;
  is_verified: boolean;
  clientCount?: number;
  client_count?: number;
}


