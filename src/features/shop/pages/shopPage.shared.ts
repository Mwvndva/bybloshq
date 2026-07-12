import { type CSSProperties } from 'react';
import type { Product, Seller, Aesthetic } from '@/types';
import type { Theme } from '@/hooks/useShopTheme';

export const SHOP_DEFAULT_BANNER_STYLE: CSSProperties = {
  background: [
    'radial-gradient(circle at 18% 18%, rgba(var(--theme-accent-rgb), 0.28), transparent 28%)',
    'radial-gradient(circle at 82% 32%, rgba(var(--theme-accent-rgb), 0.18), transparent 30%)',
    'linear-gradient(135deg, var(--theme-bg-color) 0%, var(--theme-card-bg) 52%, var(--theme-accent) 100%)'
  ].join(', ')
};

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
  bannerImage?: string;
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
