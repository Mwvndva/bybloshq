export const money = (amount: number | string) => `KSh ${Number(amount || 0).toLocaleString()}`;
export const MIN_WITHDRAWAL_AMOUNT = 50;
export const WITHDRAWAL_FEE_TIERS = [
  { min: 50, max: 1500, fee: 21, label: 'KSh 50 - KSh 1,500' },
  { min: 1501, max: 19999.99, fee: 45, label: 'KSh 1,501 - KSh 19,999' },
  { min: 20000, max: Number.POSITIVE_INFINITY, fee: 63, label: 'KSh 20,000 and above' }
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
  slug?: string;
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
export type CreatorClearance = {
  totalBalance?: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
};

export type DashboardData = {
  creator?: CreatorProfile;
  clearance?: CreatorClearance;
  shops?: LinkedShop[];
  shopRequests?: ShopRequest[];
  analysis?: AnalysisRow[];
  monthly?: AnalysisRow[];
  withdrawals?: WithdrawalRow[];
  leaderboard?: LeaderboardRow[];
  linkClicks?: number;
};
export type ReferralData = { referralCode?: string };

export function getMaxWithdrawableAmount(availableBalance: number): number {
  if (!Number.isFinite(availableBalance) || availableBalance < MIN_WITHDRAWAL_AMOUNT + 21) {
    return 0;
  }
  if (availableBalance >= 20000 + 63) {
    return Math.floor((availableBalance - 63) * 100) / 100;
  }
  if (availableBalance >= 1501 + 45) {
    const net = Math.floor((availableBalance - 45) * 100) / 100;
    return Math.min(19999.99, net);
  }
  if (availableBalance >= 50 + 21) {
    const net = Math.floor((availableBalance - 21) * 100) / 100;
    return Math.min(1500, net);
  }
  return 0;
}

export function formatSettlementDate(dateStr?: string | Date | null): string {
  if (!dateStr) return 'Pending schedule';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Pending schedule';
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSettlementTimeOnly(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.message || apiError?.message || fallback;
};
