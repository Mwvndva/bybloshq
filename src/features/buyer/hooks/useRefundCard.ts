import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePendingRefundsQuery } from '@/features/buyer/hooks/queries/usePendingRefundsQuery';
import { useRefundRequestMutation } from '@/features/buyer/hooks/mutations/useRefundRequestMutation';
import { useAsyncLock } from '@/shared/hooks/useAsyncLock';
import {
  getWithdrawalFee,
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWAL_FEE_TIERS,
  getMaxWithdrawableAmount,
  formatKes
} from '@/features/buyer/utils/refundUtils';

interface PendingRequest {
  id: number;
  amount: number;
  status: string;
  requested_at: string;
  withdrawal_fee?: number;
  total_deducted?: number;
}

interface PendingRefundsResponse {
  pendingRequests?: PendingRequest[];
  hasPending?: boolean;
  totalRefunds?: number;
  availableBalance?: number;
  clearingBalance?: number;
  nextAvailableAt?: string | null;
  isClearing?: boolean;
  buyerPhone?: string;
  buyerName?: string;
}

export function useRefundCard(refundAmount: number, onRefundRequested?: () => void) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [mpesaName, setMpesaName] = useState('');

  const { runWithLock, isLocked: isSubmitting } = useAsyncLock();

  // React Query: fetch pending refund requests and T+2 clearance state
  const pendingRefundsQuery = usePendingRefundsQuery();
  const queryData = pendingRefundsQuery.data as PendingRefundsResponse | undefined;

  const pendingRequests: PendingRequest[] = queryData?.pendingRequests ?? [];
  const isLoadingPending = pendingRefundsQuery.isLoading;

  const totalRefunds = typeof queryData?.totalRefunds === 'number'
    ? queryData.totalRefunds
    : refundAmount;

  const clearingBalance = typeof queryData?.clearingBalance === 'number'
    ? queryData.clearingBalance
    : 0;

  const availableBalance = typeof queryData?.availableBalance === 'number'
    ? queryData.availableBalance
    : Math.max(0, totalRefunds - clearingBalance);

  const isClearing = Boolean(queryData?.isClearing || clearingBalance > 0);
  const nextAvailableAt = queryData?.nextAvailableAt ?? null;

  const buyerDefaultPhone = queryData?.buyerPhone || '';
  const buyerDefaultName = queryData?.buyerName || '';

  // Max net amount buyer can withdraw such that amount + fee <= availableBalance
  const maxWithdrawable = useMemo(() => {
    return getMaxWithdrawableAmount(availableBalance);
  }, [availableBalance]);

  // Sync default M-Pesa details when query loads
  useEffect(() => {
    if (buyerDefaultPhone && !mpesaNumber) {
      setMpesaNumber(buyerDefaultPhone);
    }
    if (buyerDefaultName && !mpesaName) {
      setMpesaName(buyerDefaultName);
    }
  }, [buyerDefaultPhone, buyerDefaultName, mpesaNumber, mpesaName]);

  const parsedAmount = Number.parseFloat(withdrawalAmount) || 0;
  const withdrawalFee = getWithdrawalFee(parsedAmount);
  const totalDeducted = parsedAmount > 0 ? parsedAmount + withdrawalFee : 0;
  const remainingBalance = Math.max(0, availableBalance - totalDeducted);

  const formatCurrency = (value: number) => formatKes(value);

  const handleWithdrawClick = () => {
    if (totalRefunds <= 0) {
      toast.error('No refunds available to withdraw');
      return;
    }
    if (pendingRequests.length > 0) {
      toast.error('You already have a pending withdrawal request');
      return;
    }
    if (isClearing && availableBalance < MIN_WITHDRAWAL_AMOUNT) {
      toast.error('Your refunds are currently clearing under the standard T+2 holding period.');
      return;
    }
    if (availableBalance < MIN_WITHDRAWAL_AMOUNT + 21) {
      toast.error(`Minimum withdrawal is KSh ${MIN_WITHDRAWAL_AMOUNT} + KSh 21 fee (KSh 71 required balance).`);
      return;
    }

    // Default to maximum withdrawable net amount
    if (maxWithdrawable > 0 && !withdrawalAmount) {
      setWithdrawalAmount(maxWithdrawable.toString());
    }
    if (buyerDefaultPhone && !mpesaNumber) {
      setMpesaNumber(buyerDefaultPhone);
    }
    if (buyerDefaultName && !mpesaName) {
      setMpesaName(buyerDefaultName);
    }

    setIsDialogOpen(true);
  };

  const handleSetMaxAmount = () => {
    if (maxWithdrawable > 0) {
      setWithdrawalAmount(maxWithdrawable.toString());
    }
  };

  const refundMutation = useRefundRequestMutation();

  const handleConfirmWithdraw = async () => {
    if (parsedAmount < MIN_WITHDRAWAL_AMOUNT) {
      toast.error(`Minimum withdrawal amount is KSh ${MIN_WITHDRAWAL_AMOUNT}`);
      return;
    }

    if (totalDeducted > availableBalance) {
      toast.error(`Total deduction (KSh ${totalDeducted}) exceeds your available balance of KSh ${availableBalance}`);
      return;
    }

    if (!mpesaNumber?.trim()) {
      toast.error('M-Pesa phone number is required');
      return;
    }

    if (!mpesaName?.trim()) {
      toast.error('Name as registered on M-Pesa is required');
      return;
    }

    await runWithLock(async () => {
      try {
        await refundMutation.mutateAsync({
          amount: parsedAmount,
          mpesaNumber: mpesaNumber.trim(),
          mpesaName: mpesaName.trim()
        });

        setIsDialogOpen(false);

        if (onRefundRequested) {
          onRefundRequested();
        }
      } catch (error) {
        console.error('Error requesting refund withdrawal:', error);
      }
    });
  };

  const hasPendingRequest = pendingRequests.length > 0;

  return {
    isDialogOpen,
    setIsDialogOpen,
    isSubmitting,
    pendingRequests,
    isLoadingPending,
    formatCurrency,
    handleWithdrawClick,
    handleConfirmWithdraw,
    handleSetMaxAmount,
    hasPendingRequest,
    totalRefunds,
    availableBalance,
    clearingBalance,
    isClearing,
    nextAvailableAt,
    maxWithdrawable,
    withdrawalAmount,
    setWithdrawalAmount,
    mpesaNumber,
    setMpesaNumber,
    mpesaName,
    setMpesaName,
    withdrawalFee,
    totalDeducted,
    remainingBalance,
    feeTiers: WITHDRAWAL_FEE_TIERS,
    minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT
  };
}
