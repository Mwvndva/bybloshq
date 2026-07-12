import { useState } from 'react';
import { toast } from 'sonner';
import { usePendingRefundsQuery } from '@/hooks/buyer/queries/usePendingRefundsQuery';
import { useRefundRequestMutation } from '@/hooks/buyer/mutations/useRefundRequestMutation';
import { useAsyncLock } from '@/hooks/useAsyncLock';

interface PendingRequest {
  id: number;
  amount: number;
  status: string;
  requested_at: string;
}

export function useRefundCard(refundAmount: number, onRefundRequested?: () => void) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // FIX (Task 16): Prevent duplicate refund submissions via synchronous lock
  const { runWithLock, isLocked: isSubmitting } = useAsyncLock();

  // React Query: fetch pending refund requests
  const pendingRefundsQuery = usePendingRefundsQuery();
  const pendingRequests: PendingRequest[] = (pendingRefundsQuery.data as { pendingRequests?: PendingRequest[] })?.pendingRequests ?? [];
  const isLoadingPending = pendingRefundsQuery.isLoading;

  // React Query: refund request mutation
  const refundMutation = useRefundRequestMutation();

  // Format currency
  const formatCurrency = (value: number) => {
    return `KSh ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleWithdrawClick = () => {
    if (refundAmount <= 0) {
      toast.error('No refunds available to withdraw');
      return;
    }
    if (pendingRequests.length > 0) {
      toast.error('You already have a pending refund request');
      return;
    }
    setIsDialogOpen(true);
  };

  const handleConfirmWithdraw = async () => {
    // FIX (Task 16): Prevents duplicate refund submission
    await runWithLock(async () => {
      try {
        await refundMutation.mutateAsync({ amount: refundAmount });

        setIsDialogOpen(false);

        // Notify parent to refresh data
        if (onRefundRequested) {
          onRefundRequested();
        }
      } catch (error) {
        console.error('Error requesting refund:', error);
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
    hasPendingRequest,
  };
}
