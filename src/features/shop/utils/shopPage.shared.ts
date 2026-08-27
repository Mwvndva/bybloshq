import type { Product, Seller, Aesthetic } from '@/shared/types';
import type { Theme } from '@/shared/hooks/useShopTheme';

// Type guard to check if a string is a valid Aesthetic
export function isAesthetic(value: string): value is Aesthetic {
  return [
    'all',
    'clothes-style',
    'sneakers-shoes',
    'beauty-fragrance',
    'art-decor-crafts',
    'electronics-accessories',
    'home-living',
    'health-wellness'
  ].includes(value);
}

export const getSellerInitials = (shopName?: string, fullName?: string) => {
  const source = (shopName || fullName || 'Shop').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

// Base product type that matches the Product interface but makes some fields optional
export interface BaseProduct extends Omit<Product, 'seller' | 'aesthetic' | 'isSold' | 'status'> {
  seller?: Seller;
  isSold: boolean;
  status: 'available' | 'sold';
  aesthetic: Aesthetic | string;
}

// Shop-specific product type that extends the base product
export interface ShopProduct extends Omit<BaseProduct, 'seller'> {
  seller?: ShopSeller;
}

// Shop-specific seller type that extends the base Seller type
export interface ShopSeller extends Omit<Seller, 'bannerUrl'> {
  theme?: Theme;
  city?: string;
  instagramLink?: string;
  tiktokLink?: string;
  facebookLink?: string;
  clientCount?: number;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
}

