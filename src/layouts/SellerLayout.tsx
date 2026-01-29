import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SellerDashboardLayout } from '@/layouts/BaseDashboardLayout';
import { Home, Package, ShoppingBag, Settings, Store } from 'lucide-react';

export function SellerLayout() {
    const location = useLocation();
    const navigationItems = [
        { label: 'Dashboard', path: '/seller/dashboard', icon: Home },
        { label: 'Products', path: '/seller/products', icon: Package },
        { label: 'Orders', path: '/seller/orders', icon: ShoppingBag },
        { label: 'Shop Setup', path: '/seller/shop-setup', icon: Store },
        { label: 'Settings', path: '/seller/settings', icon: Settings },
    ];



    return (
        <SellerDashboardLayout
            title="Seller Dashboard"
            subtitle="Manage your products and orders"
            navigationItems={navigationItems}
            showBackButton={true}
            backButtonPath="/"
            backButtonLabel="Back to Home"
        >
            <Outlet />
        </SellerDashboardLayout>
    );
}

export default SellerLayout;
