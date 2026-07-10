import React from 'react';
import { Outlet } from 'react-router-dom';
import { SellerDashboardLayout } from '@/layouts/BaseDashboardLayout';
import { Home, ShoppingBag, Settings } from 'lucide-react';
import { useSellerAuth } from '@/features/auth/contexts';

export function SellerLayout() {
    const { seller } = useSellerAuth();
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


