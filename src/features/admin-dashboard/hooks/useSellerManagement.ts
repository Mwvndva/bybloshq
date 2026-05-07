/**
 * useSellerManagement.ts
 * Manages seller list state and admin actions.
 * Extracted from NewAdminDashboard.tsx to isolate seller-related re-renders.
 */
import { useState, useCallback } from 'react';
import { adminApi } from '@/api/adminApi';
import { toast } from 'sonner';

export function useSellerManagement(initialSellers: any[]) {
    const [sellers, setSellers] = useState<any[]>(initialSellers);
    const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
    const [isLoadingSeller, setIsLoadingSeller] = useState(false);

    const handleViewSeller = useCallback(async (sellerId: string) => {
        setIsLoadingSeller(true);
        try {
            const response = await adminApi.getSellerById(sellerId);
            setSelectedSeller(response);
        } catch {
            toast.error('Failed to load seller details');
        } finally {
            setIsLoadingSeller(false);
        }
    }, []);

    const closeSellerModal = useCallback(() => setSelectedSeller(null), []);

    const handleToggleStatus = useCallback(async (sellerId: string, newStatus: 'active' | 'inactive') => {
        try {
            const response = await adminApi.updateSellerStatus(sellerId, { status: newStatus });
            if (response.data.status === 'success') {
                setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, status: newStatus } : s));
                toast.success(`Seller has been ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            }
        } catch {
            toast.error('Failed to update seller status');
        }
    }, []);

    const handleDelete = useCallback(async (userId: string) => {
        if (!window.confirm('Are you sure you want to block and delete this seller? This action cannot be undone.')) return;
        try {
            await adminApi.deleteUser(userId);
            setSellers(prev => prev.filter(s => s.id !== userId));
            toast.success('Seller account deleted successfully');
        } catch {
            toast.error('Failed to delete seller account');
        }
    }, []);

    return { sellers, setSellers, selectedSeller, isLoadingSeller, handleViewSeller, closeSellerModal, handleToggleStatus, handleDelete };
}
