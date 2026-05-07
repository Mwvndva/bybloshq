/**
 * useWithdrawals.ts
 * Manages withdrawal request state and actions.
 * Extracted from NewAdminDashboard.tsx to prevent full-dashboard re-renders
 * on withdrawal approval / rejection.
 */
import { useState, useCallback } from 'react';
import { adminApi } from '@/api/adminApi';
import { toast } from 'sonner';
import type { WithdrawalRequest } from './useDashboardData';

export function useWithdrawals(
    initial: WithdrawalRequest[],
    onUpdate?: (updated: WithdrawalRequest[]) => void
) {
    const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>(initial);

    const handleAction = useCallback(async (requestId: string, action: 'approved' | 'rejected') => {
        try {
            const response = await adminApi.updateWithdrawalRequestStatus(requestId, action);
            if (response.data.status === 'success') {
                setWithdrawalRequests(prev =>
                    prev.map(r =>
                        r.id === requestId
                            ? { ...r, status: action, processedAt: new Date().toISOString(), processedBy: 'Admin' }
                            : r
                    )
                );
                onUpdate?.(withdrawalRequests);
                toast.success(`Withdrawal request has been ${action}`);
            }
        } catch {
            toast.error('Failed to update withdrawal request status');
        }
    }, [withdrawalRequests, onUpdate]);

    return { withdrawalRequests, setWithdrawalRequests, handleAction };
}
