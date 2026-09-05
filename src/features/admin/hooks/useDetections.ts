import { useState } from 'react';
import { toast } from 'sonner';
import { useFlaggedEarningsQuery, useResolveFlaggedEarningMutation } from '@/features/admin/hooks/mutations/useAdminDetections';
import type { FlaggedEarning } from '../types/detections';

export function useDetections() {
  const [selectedEarning, setSelectedEarning] = useState<FlaggedEarning | null>(null);
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [isReverseDialogOpen, setIsReverseDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const resolveMutation = useResolveFlaggedEarningMutation();
  const flaggedQuery = useFlaggedEarningsQuery();

  const earnings = flaggedQuery.data?.data || [];
  const isLoading = flaggedQuery.isLoading;

  const fetchFlaggedEarnings = async () => {
    await flaggedQuery.refetch();
  };

  const resolve = async (action: 'release' | 'reverse') => {
    if (!selectedEarning) return;

    setIsProcessing(true);
    try {
      const idempotencyKey = `detection-${action}-${selectedEarning.earning_type}-${selectedEarning.id}`;
      await resolveMutation.mutateAsync({
        earningType: selectedEarning.earning_type,
        id: selectedEarning.id,
        action,
        notes: reviewNotes,
        idempotencyKey
      });

      toast.success(action === 'release' ? 'Earning released — cleared for normal withdrawal.' : 'Earning reversed and clawed back.');
      setIsReleaseDialogOpen(false);
      setIsReverseDialogOpen(false);
      setReviewNotes('');
      setSelectedEarning(null);
      await fetchFlaggedEarnings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || `Failed to ${action} earning`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    earnings,
    isLoading,
    selectedEarning,
    setSelectedEarning,
    isReleaseDialogOpen,
    setIsReleaseDialogOpen,
    isReverseDialogOpen,
    setIsReverseDialogOpen,
    reviewNotes,
    setReviewNotes,
    isProcessing,
    fetchFlaggedEarnings,
    handleRelease: () => resolve('release'),
    handleReverse: () => resolve('reverse'),
  };
}
