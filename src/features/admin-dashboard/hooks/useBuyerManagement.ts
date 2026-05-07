/**
 * useBuyerManagement.ts
 * Manages buyer list state and admin actions.
 * Extracted from NewAdminDashboard.tsx to isolate buyer-related re-renders.
 */
import { useState, useCallback } from 'react';
import { adminApi } from '@/api/adminApi';
import { toast } from 'sonner';

export function useBuyerManagement(initialBuyers: any[]) {
    const [buyers, setBuyers] = useState<any[]>(initialBuyers);
    const [selectedBuyer, setSelectedBuyer] = useState<any | null>(null);
    const [isLoadingBuyer, setIsLoadingBuyer] = useState(false);

    const handleViewBuyer = useCallback(async (buyerId: string) => {
        setIsLoadingBuyer(true);
        try {
            const response = await adminApi.getBuyerById(buyerId);
            setSelectedBuyer(response);
        } catch {
            toast.error('Failed to load buyer details');
        } finally {
            setIsLoadingBuyer(false);
        }
    }, []);

    const closeBuyerModal = useCallback(() => setSelectedBuyer(null), []);

    const handleToggleStatus = useCallback(async (buyerId: string, newStatus: 'active' | 'inactive') => {
        try {
            const response = await adminApi.updateBuyerStatus(buyerId, { status: newStatus });
            if (response.data.status === 'success') {
                setBuyers(prev => prev.map(b => b.id === buyerId ? { ...b, status: newStatus } : b));
                toast.success(`Buyer has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            }
        } catch {
            toast.error('Failed to update buyer status');
        }
    }, []);

    const handleDelete = useCallback(async (userId: string) => {
        if (!window.confirm('Are you sure you want to block and delete this buyer? This action cannot be undone.')) return;
        try {
            await adminApi.deleteUser(userId);
            setBuyers(prev => prev.filter(b => b.id !== userId));
            toast.success('Buyer account deleted successfully');
        } catch {
            toast.error('Failed to delete buyer account');
        }
    }, []);

    return { buyers, setBuyers, selectedBuyer, isLoadingBuyer, handleViewBuyer, closeBuyerModal, handleToggleStatus, handleDelete };
}
