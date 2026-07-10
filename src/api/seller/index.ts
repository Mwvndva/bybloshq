import { checkShopNameAvailability, sellerProfileApi, transformSeller } from './profileApi';
import { sellerProductsApi, transformProduct } from './productsApi';
import { sellerOrdersApi } from './ordersApi';
import { sellerWithdrawalsApi, withdrawalService } from './withdrawalsApi';

export type {
  OrderQueryParams,
  OrdersAnalytics,
  ReferralDashboard,
  ReferredSeller,
  RegisterSellerInput,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from './types';

export type { ApiSellerProduct as Product } from '@/types/api/product';
export type { ApiSeller as Seller } from '@/types/api/seller';
export type { ApiWithdrawalRequest as WithdrawalRequest } from '@/types/api/withdrawal';

export { checkShopNameAvailability, transformProduct, transformSeller, withdrawalService };

/**
 * Aggregated seller API surface. This barrel is the single source of truth for
 * the seller API layer; the individual modules under `./` own the actual calls.
 */
export const sellerApi = {
  ...sellerProfileApi,
  ...sellerProductsApi,
  ...sellerOrdersApi,
  ...sellerWithdrawalsApi
};

export default sellerApi;
