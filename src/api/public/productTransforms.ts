import { transformSeller, type ApiPublicSeller } from './sellerTransforms';

import type { ApiProduct } from '@/types/api/product';
export type { ApiProduct };


export const transformProduct = (product: unknown): ApiProduct => {
  const pObj = product as Record<string, unknown>;
  let price = 0;
  if (pObj.price !== null && pObj.price !== undefined) {
    if (typeof pObj.price === 'number') {
      price = pObj.price;
    } else if (typeof pObj.price === 'string') {
      const parsed = Number.parseFloat(pObj.price);
      price = Number.isNaN(parsed) ? 0 : parsed;
    } else if (typeof pObj.price === 'object') {
      const priceObj = pObj.price as Record<string, unknown>;
      const numericValue = priceObj.value || priceObj.amount || priceObj.price || 0;
      price = typeof numericValue === 'number' ? numericValue : 0;
    }
  }

  // The backend product carries many pass-through fields (...pObj); build a loose
  // record and cast once at the boundary rather than enumerating every field.
  const transformedProduct: Record<string, unknown> = {
    ...pObj,
    price,
    image_url: pObj.image_url || pObj.imageUrl,
    sellerId: pObj.sellerId || pObj.seller_id,
    isSold: pObj.isSold || pObj.is_sold || pObj.status === 'sold',
    status: pObj.status || (pObj.isSold || pObj.is_sold ? 'sold' : 'available'),
    createdAt: pObj.createdAt || pObj.created_at,
    updatedAt: pObj.updatedAt || pObj.updated_at,
    soldAt: pObj.soldAt || pObj.sold_at
  };

  if (pObj.seller) {
    transformedProduct.seller = transformSeller(pObj.seller);
  }

  return transformedProduct as unknown as ApiProduct;
};


