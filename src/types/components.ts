import { Aesthetic } from './index';

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

export interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    sellerId: string;
    seller?: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
    isSold: boolean;
    status: 'available' | 'sold';
    soldAt?: string | null;
    createdAt: string;
    updatedAt: string;
    aesthetic: Aesthetic;
  };
  seller?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
}

export interface WishlistItemProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    seller?: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
    isSold: boolean;
    status: 'available' | 'sold';
    soldAt?: string | null;
    createdAt: string;
    updatedAt: string;
    aesthetic: Aesthetic;
  };
  onRemove: (productId: string) => void;
}
