import { buyerApiInstance } from './instance';
import { getBuyerProfile, updateBuyerProfile, getProfile, updateProfile } from './profile';
import { login, register, resendVerification, forgotPassword, resetPassword, checkBuyerByPhone, saveBuyerInfo, autoLogin, verifyEmail } from './auth';
import { getOrders, getOrder, cancelOrder, confirmOrderReceipt, markOrderAsCollected, downloadDigitalProduct } from './orders';
import { getWishlist, addToWishlist, removeFromWishlist, syncWishlist } from './wishlist';
import { getOrderStatus, initiateProduct, validateDiscountCode, getPaymentStatus, getLogisticsQuote } from './payments';
import { requestRefund, getPendingRefundRequests } from './refunds';
import { leaveClient, getShops } from './shops';

export * from './instance';
export * from './profile';
export * from './auth';
export * from './orders';
export * from './wishlist';
export * from './payments';
export * from './refunds';
export * from './shops';

export const buyerApi = {
  login,
  register,
  resendVerification,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  syncWishlist,
  getOrders,
  getOrder,
  cancelOrder,
  confirmOrderReceipt,
  checkBuyerByPhone,
  saveBuyerInfo,
  requestRefund,
  getPendingRefundRequests,
  downloadDigitalProduct,
  markOrderAsCollected,
  leaveClient,
  getShops,
  verifyEmail,
  getOrderStatus,
  autoLogin,
  initiateProduct,
  validateDiscountCode,
  getPaymentStatus,
  getLogisticsQuote
};

export default buyerApi;
export { buyerApiInstance };
export { getBuyerProfile, updateBuyerProfile };


