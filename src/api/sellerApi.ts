import { checkShopNameAvailability, sellerProfileApi, transformSeller } from './seller/profileApi';
import { sellerProductsApi, transformProduct } from './seller/productsApi';
import { sellerOrdersApi } from './seller/ordersApi';
import { sellerWithdrawalsApi, withdrawalService } from './seller/withdrawalsApi';

export type {
  OrderQueryParams,
  OrdersAnalytics,
  Product,
  ReferralDashboard,
  ReferredSeller,
  RegisterSellerInput,
  Seller,
  SellerAnalytics,
  Theme,
  UpdateSellerProfileInput,
  WithdrawalRequest
} from './seller/types';

export { checkShopNameAvailability, transformProduct, transformSeller, withdrawalService };

export const sellerApi = {
  ...sellerProfileApi,
  ...sellerProductsApi,
  ...sellerOrdersApi,
  ...sellerWithdrawalsApi
};

export default sellerApi;
