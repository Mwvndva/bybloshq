// Barrel for the seller controller, split by domain in Phase 15.7b.
// Routes import `* as sellerController` from here, so every handler stays
// reachable by the same name and the public HTTP contract is unchanged.
export {
  logout,
  register,
  login,
  resetPassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
} from '../../identity/auth/seller.auth.controller.js';

export {
  checkShopNameAvailability,
  getSellerByShopName,
  searchSellers,
  getSellerProducts,
  getSellerById,
} from './seller.shop.controller.js';

export {
  getProfile,
  updateProfile,
  updateTheme,
  uploadBusinessPhoto,
} from './seller.profile.controller.js';
