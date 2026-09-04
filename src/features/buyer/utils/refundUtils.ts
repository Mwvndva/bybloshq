import {
  getWithdrawalFee,
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS
} from '@/features/seller/components/dashboard/dashboardUtils';
import {
  formatKes,
  formatSettlementDate,
  formatSettlementTimeOnly
} from '@/features/seller/components/dashboard/tabs/withdrawalsTab.utils';

export {
  getWithdrawalFee,
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  formatKes,
  formatSettlementDate,
  formatSettlementTimeOnly
};

/**
 * Checks if a date falls on a weekend (Saturday or Sunday in UTC).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Adds business days (excluding weekends) to a start date (matching backend settlement logic).
 */
export function addBusinessDays(startDate: Date | string | number, days = 2): Date {
  const result = new Date(startDate);
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
}

/**
 * Calculates the maximum net withdrawal amount A such that A + getWithdrawalFee(A) <= availableBalance.
 * Returns 0 if availableBalance is less than MIN_WITHDRAWAL_AMOUNT + minimum fee (KSh 71).
 */
export function getMaxWithdrawableAmount(availableBalance: number): number {
  if (!Number.isFinite(availableBalance) || availableBalance < MIN_WITHDRAWAL_AMOUNT + 21) {
    return 0;
  }

  // Tier 3: >= 20,000, fee = 63. Threshold: 20000 + 63 = 20063
  if (availableBalance >= 20000 + 63) {
    return Math.floor((availableBalance - 63) * 100) / 100;
  }

  // Tier 2: 1,501 - 19,999.99, fee = 45. Threshold: 1501 + 45 = 1546
  if (availableBalance >= 1501 + 45) {
    const net = Math.floor((availableBalance - 45) * 100) / 100;
    // Cap at 19999.99 so fee doesn't jump to 63
    return Math.min(19999.99, net);
  }

  // Tier 1: 50 - 1,500, fee = 21. Threshold: 50 + 21 = 71
  if (availableBalance >= 50 + 21) {
    const net = Math.floor((availableBalance - 21) * 100) / 100;
    // Cap at 1500 so fee doesn't jump to 45
    return Math.min(1500, net);
  }

  return 0;
}
