import { checkShopNameAvailability, sellerProfileApi, transformSeller } from './seller/profileApi';
import { sellerProductsApi, transformProduct } from './seller/productsApi';
import { sellerOrdersApi } from './seller/ordersApi';
import { sellerWithdrawalsApi, withdrawalService } from './seller/withdrawalsApi';

export type {
  OrderQueryParams,
  OrdersAnalytics,
  ReferralDashboard,
  ReferredSeller,
  RegisterSellerInput,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput
} from './seller/types';

export type { ApiSellerProduct as Product } from '@/types/api/product';
export type { ApiSeller as Seller } from '@/types/api/seller';
export type { ApiWithdrawalRequest as WithdrawalRequest } from '@/types/api/withdrawal';

export { checkShopNameAvailability, transformProduct, transformSeller, withdrawalService };

export const sellerApi = {
  ...sellerProfileApi,
  ...sellerProductsApi,
  ...sellerOrdersApi,
  ...sellerWithdrawalsApi
};

export default sellerApi;


