import type { ProductType } from '../index';

// Used in public transforms (public buyer-facing API)
export interface ApiProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  imageUrl?: string;
  aesthetic: string;
  sellerId: string;
  seller_id?: string;
  isSold: boolean;
  is_sold?: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  sold_at?: string | null;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  seller?: import('./seller').ApiPublicSeller; // To be mapped to Seller domain model
}

// Used in seller api/types (seller management dashboard backend API)
export interface ApiSellerProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  images?: string[];
  aesthetic: string;
  sellerId: string;
  isSold: boolean;
  status: 'available' | 'sold';
  soldAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  is_digital?: boolean;
  digital_file_path?: string;
  digital_file_name?: string;
  productType?: ProductType;
  product_type?: ProductType;
  is_custom_product?: boolean;
  isCustomProduct?: boolean;
  production_days?: number | null;
  productionDays?: number | null;
  customization_prompt?: string | null;
  customizationPrompt?: string | null;
  is_imported_product?: boolean;
  isImportedProduct?: boolean;
  import_days?: number | null;
  importDays?: number | null;
  import_note?: string | null;
  importNote?: string | null;
  track_inventory?: boolean;
  quantity?: number | null;
  low_stock_threshold?: number | null;
  isDigital?: boolean;
  serviceOptions?: { location_type?: string; price_type?: string };
  serviceLocations?: unknown;
}



