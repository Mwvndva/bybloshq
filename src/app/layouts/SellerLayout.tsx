import React from 'react';
import { Outlet } from 'react-router-dom';
import { SellerDashboardLayout } from '@/app/layouts/BaseDashboardLayout';
import { Home, ShoppingBag, Settings } from 'lucide-react';
import { useGlobalAuth } from '@/features/auth/contexts';
import type { SellerProfile } from '@/features/auth/types/authTypes';

export function SellerLayout() {
    const { user } = useGlobalAuth();
    const seller = user?.role === 'seller' ? user.profile as SellerProfile : null;
    const sellerFirstName = seller?.fullName?.trim().split(/\s+/)[0] || seller?.shopName?.trim().split(/\s+/)[0] || 'Seller';
    const navigationItems = [
        { label: 'Dashboard', path: '/seller/dashboard', icon: Home },
        { label: 'Orders', path: '/seller/orders', icon: ShoppingBag },
        { label: 'Settings', path: '/seller/settings', icon: Settings },
    ];



    return (
        <SellerDashboardLayout
            title={`Welcome, ${sellerFirstName}`}
            navigationItems={navigationItems}
            showBackButton={true}
            showHeader={false}
            backButtonPath="/"
            backButtonLabel="Back to Home"
        >
            <Outlet />
        </SellerDashboardLayout>
    );
}

export default SellerLayout;


