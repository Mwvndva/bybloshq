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
} from './seller.auth.controller.js';

export {
  checkShopNameAvailability,
  getSellerByShopName,
  searchSellers,
  getSellerProducts,
  getSellerById,
  getBuyerShops,
} from './seller.shop.controller.js';

export {
  getProfile,
  updateProfile,
  updateTheme,
  uploadBanner,
  uploadBusinessPhoto,
} from './seller.profile.controller.js';

export {
  handleBecomeClient,
  handleLeaveClient,
} from './seller.clientele.controller.js';
