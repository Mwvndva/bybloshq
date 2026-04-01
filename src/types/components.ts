import type { Product, Aesthetic } from './index';

export type AestheticWithNone = Aesthetic | '';

export interface ProductGridProps {
  selectedAesthetic: AestheticWithNone;
  searchQuery?: string;
  locationCity?: string;
  locationArea?: string;
  priceMin?: number;
  priceMax?: number;
}

export interface AestheticCategoriesProps {
  selectedAesthetic: AestheticWithNone;
  onAestheticChange: (aesthetic: AestheticWithNone) => void;
}

// Use the canonical Product type — never redefine inline
export interface ProductCardProps {
  product: Product;
  seller?: Product['seller'];
  hideWishlist?: boolean;
  theme?: string;
}

export interface WishlistItemProps {
  product: Product;
  onRemove: (productId: string) => void;
}
