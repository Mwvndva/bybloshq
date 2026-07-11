export const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;
export const MIN_WITHDRAWAL_AMOUNT = 50;
export const WITHDRAWAL_FEE_TIERS = [
  { min: 50, max: 1500, fee: 21 },
  { min: 1501, max: 19999.99, fee: 45 },
  { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63 }
] as const;
export const getWithdrawalFee = (amount: number) => {
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) return 0;
  return WITHDRAWAL_FEE_TIERS.find(({ min, max }) => amount >= min && amount <= max)?.fee || 0;
};
export type AnalysisPeriod = 'daily' | 'weekly' | 'monthly';
export type ApiError = { response?: { data?: { message?: string } }; message?: string };
export type CreatorProfile = {
  balance?: number;
  firstName?: string;
  mpesaNumber?: string;
  totalEarnings?: number;
  totalSales?: number;
};
export type ShopRequest = { id: number; shop_name?: string; seller_name?: string };
export type LinkedShop = {
  id: number;
  shop_name?: string;
  code?: string;
  commission_rate?: number | string;
  sales_count?: number | string;
  click_count?: number | string;
  earnings?: number | string;
};
export type AnalysisRow = {
  period?: string;
  month?: string;
  sales?: number | string;
  sales_value?: number | string;
  salesValue?: number | string;
  earnings?: number | string;
  clicks?: number | string;
};
export type WithdrawalRow = { id: number; amount?: number | string; withdrawal_fee?: number | string; status?: string };
export type LeaderboardRow = {
  id: number;
  first_name?: string;
  last_name?: string;
  total_sales?: number | string;
  total_income?: number | string;
};
export type DashboardData = {
  creator?: CreatorProfile;
  shops?: LinkedShop[];
  shopRequests?: ShopRequest[];
  analysis?: AnalysisRow[];
  monthly?: AnalysisRow[];
  withdrawals?: WithdrawalRow[];
  leaderboard?: LeaderboardRow[];
  linkClicks?: number;
};
export type ReferralData = { referralCode?: string };

export const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};
