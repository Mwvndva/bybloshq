import { publicApi } from './instance';
import { searchSellers, searchProducts } from './search';
import { getSellersPage, getSellers, knockSeller, getSellerInfo } from './sellers';
import { getProductsPage, getProducts, getProduct, getFeaturedProducts, getProductsByLocation } from './products';
import { becomeClient } from './clients';
import { pollPaymentStatus } from './payments';
import { fetchPublicTracking } from './tracking';

export * from './instance';
export * from './search';
export * from './sellers';
export * from './products';
export * from './clients';
export * from './payments';
export * from './tracking';

export const publicApiService = {
  searchSellers,
  getSellersPage,
  getSellers,
  knockSeller,
  getProductsPage,
  getProducts,
  getProduct,
  getSellerInfo,
  getFeaturedProducts,
  searchProducts,
  getProductsByLocation,
  becomeClient,
  pollPaymentStatus
};

export default publicApiService;
export { publicApi };


