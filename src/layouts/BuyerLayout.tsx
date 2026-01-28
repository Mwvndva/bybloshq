import React from 'react';
import { Outlet } from 'react-router-dom';
import { BuyerDashboardLayout } from '@/layouts/BaseDashboardLayout';
import { Home, Heart, ShoppingBag, User, Settings } from 'lucide-react';

export function BuyerLayout() {
    const navigationItems = [
        { label: 'Dashboard', path: '/buyer/dashboard', icon: Home },
        { label: 'Wishlist', path: '/buyer/wishlist', icon: Heart },
        { label: 'Orders', path: '/buyer/orders', icon: ShoppingBag },
        { label: 'Profile', path: '/buyer/profile', icon: User },
        { label: 'Settings', path: '/buyer/settings', icon: Settings },
    ];

    return (
        <BuyerDashboardLayout
            title="Buyer Dashboard"
            subtitle="Manage your orders and wishlist"
            navigationItems={navigationItems}
            showBackButton={true}
            backButtonPath="/"
            backButtonLabel="Back to Home"
        >
            <Outlet />
        </BuyerDashboardLayout>
    );
}

export default BuyerLayout;
