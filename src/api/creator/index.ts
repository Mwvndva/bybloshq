import { getInvite } from './invites';
import { register, login, logout, verifyEmail, resendVerification } from './auth';
import { getProfile } from './profile';
import { getDashboard } from './dashboard';
import { getReferralDashboard, generateReferralCode, trackLinkClick } from './referrals';
import { requestWithdrawal } from './withdrawals';
import { acceptShopRequest, denyShopRequest } from './shopRequests';

export * from './invites';
export * from './auth';
export * from './profile';
export * from './dashboard';
export * from './referrals';
export * from './withdrawals';
export * from './shopRequests';

export const creatorApi = {
  getInvite,
  register,
  login,
  logout,
  verifyEmail,
  resendVerification,
  getProfile,
  getDashboard,
  getReferralDashboard,
  generateReferralCode,
  trackLinkClick,
  requestWithdrawal,
  acceptShopRequest,
  denyShopRequest
};

export default creatorApi;


