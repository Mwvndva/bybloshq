import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi } from '@/api/sellerApi';
import { useAsyncLock } from '@/hooks/useAsyncLock';
import { MIN_WITHDRAWAL_AMOUNT } from '../dashboardUtils';
import { sellerDashboardQueryKeys } from '../queryKeys';

interface UseSellerWithdrawalsArgs {
  balance: number;
  enabled?: boolean;
  toast: (options: any) => void;
}

export function useSellerWithdrawals({ balance, enabled = true, toast }: UseSellerWithdrawalsArgs) {
  const queryClient = useQueryClient();
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    mpesaNumber: '',
    mpesaName: ''
  });
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { runWithLock, isLocked: isRequestingWithdrawal } = useAsyncLock();
  const withdrawalIdempotencyKeyRef = useRef<string | null>(null);

  const withdrawalsQuery = useQuery({
    queryKey: sellerDashboardQueryKeys.withdrawals,
    queryFn: sellerApi.getWithdrawalRequests,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: true
  });

  const withdrawalRequests = useMemo(
    () => Array.isArray(withdrawalsQuery.data) ? withdrawalsQuery.data : [],
    [withdrawalsQuery.data]
  );

  const filteredWithdrawals = useMemo(() => {
    if (!startDate && !endDate) return withdrawalRequests;

    return withdrawalRequests.filter(withdrawal => {
      const withdrawalDate = new Date(withdrawal.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        return withdrawalDate >= start && withdrawalDate <= end;
      }
      if (start) {
        return withdrawalDate >= start;
      }
      if (end) {
        return withdrawalDate <= end;
      }
      return true;
    });
  }, [endDate, startDate, withdrawalRequests]);

  const fetchWithdrawalRequests = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.withdrawals });
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load withdrawal requests. Please try again.',
        variant: 'destructive',
      });
    }
  }, [queryClient, toast]);

  const handleWithdrawalRequest = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawalForm.amount || !withdrawalForm.mpesaNumber || !withdrawalForm.mpesaName) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(withdrawalForm.amount);
    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      toast({
        title: 'Error',
        description: `Minimum withdrawal amount is KSh ${MIN_WITHDRAWAL_AMOUNT}`,
        variant: 'destructive',
      });
      return;
    }

    if (amount > balance) {
      toast({
        title: 'Error',
        description: 'Withdrawal amount cannot exceed available balance',
        variant: 'destructive',
      });
      return;
    }

    await runWithLock(async () => {
      try {
        if (!withdrawalIdempotencyKeyRef.current) {
          withdrawalIdempotencyKeyRef.current = globalThis.crypto?.randomUUID
            ? `withdrawal-${globalThis.crypto.randomUUID()}`
            : `withdrawal-${Date.now()}`;
        }

        await sellerApi.requestWithdrawal({
          amount,
          mpesaNumber: withdrawalForm.mpesaNumber,
          mpesaName: withdrawalForm.mpesaName,
          idempotencyKey: withdrawalIdempotencyKeyRef.current
        });

        toast({
          title: 'Withdrawal Initiated',
          description: 'Your withdrawal has been successfully initiated. Funds should reflect shortly.',
          className: 'bg-green-50 border-green-200 text-green-900',
        });

        setWithdrawalForm({
          amount: '',
          mpesaNumber: '',
          mpesaName: ''
        });
        setShowWithdrawalForm(false);
        withdrawalIdempotencyKeyRef.current = null;

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.withdrawals }),
          queryClient.invalidateQueries({ queryKey: sellerDashboardQueryKeys.analytics })
        ]);
      } catch (error: any) {
        console.error('Error requesting withdrawal:', error);
        const errorMessage = error.response?.data?.message || 'Failed to submit withdrawal request. Please try again.';

        toast({
          title: 'Withdrawal Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    });
  }, [balance, queryClient, runWithLock, toast, withdrawalForm]);

  return {
    endDate,
    fetchWithdrawalRequests,
    filteredWithdrawals,
    handleWithdrawalRequest,
    isWithdrawalsLoading: withdrawalsQuery.isLoading,
    isRequestingWithdrawal,
    setEndDate,
    setShowWithdrawalForm,
    setStartDate,
    setWithdrawalForm,
    showWithdrawalForm,
    startDate,
    withdrawalForm,
    withdrawalRequests
  };
}
