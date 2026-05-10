import { transformSeller, type Seller } from './sellerTransforms';

export interface Product {
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
  seller?: Seller;
}

export const transformProduct = (product: any): Product => {
  let price = 0;
  if (product.price !== null && product.price !== undefined) {
    if (typeof product.price === 'number') {
      price = product.price;
    } else if (typeof product.price === 'string') {
      const parsed = Number.parseFloat(product.price);
      price = Number.isNaN(parsed) ? 0 : parsed;
    } else if (typeof product.price === 'object') {
      const numericValue = product.price.value || product.price.amount || product.price.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  const transformedProduct: any = {
    ...product,
    price,
    image_url: product.image_url || product.imageUrl,
    sellerId: product.sellerId || product.seller_id,
    isSold: product.isSold || product.is_sold || product.status === 'sold',
    status: product.status || (product.isSold || product.is_sold ? 'sold' : 'available'),
    createdAt: product.createdAt || product.created_at,
    updatedAt: product.updatedAt || product.updated_at,
    soldAt: product.soldAt || product.sold_at
  };

  if (product.seller) {
    transformedProduct.seller = transformSeller(product.seller);
  }

  return transformedProduct as Product;
};
