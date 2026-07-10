import { adminApiInstance } from './instance';
import { login, getMe, isAuthenticated, logout } from './auth';
import { getDashboardStats } from './dashboard';
import { getAnalytics, getMonthlyMetrics } from './analytics';
import { getBuyers, getBuyerById, updateBuyerStatus, deleteUser } from './buyers';
import { getSellers, getSellerById, updateSellerStatus } from './sellers';
import { getClients } from './clients';
import { getCreators, deleteCreator } from './creators';
import { getWithdrawalRequests, updateWithdrawalRequestStatus } from './withdrawals';
import { getFinancialMetrics, getMonthlyFinancialData, getPaymentProviderBalances, getRefundRequests, confirmRefund, rejectRefund } from './financial';
import { getLogisticsRequests, updateLogisticsLegStatus, resolveLogisticsDispute } from './logistics';

export * from './instance';
export * from './auth';
export * from './dashboard';
export * from './analytics';
export * from './buyers';
export * from './sellers';
export * from './clients';
export * from './creators';
export * from './withdrawals';
export * from './financial';
export * from './logistics';

export const adminApi = {
  login,
  getMe,
  isAuthenticated,
  logout,
  getAnalytics,
  getDashboardStats,
  getBuyers,
  getBuyerById,
  getSellers,
  getCreators,
  deleteCreator,
  getSellerById,
  getMonthlyMetrics,
  updateSellerStatus,
  updateBuyerStatus,
  getClients,
  deleteUser,
  getWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getFinancialMetrics,
  getMonthlyFinancialData,
  getPaymentProviderBalances,
  getLogisticsRequests,
  updateLogisticsLegStatus,
  resolveLogisticsDispute,
  getRefundRequests,
  confirmRefund,
  rejectRefund
};

export default adminApi;
export { adminApiInstance };


