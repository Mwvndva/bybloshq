import React from 'react';
import { Outlet } from 'react-router-dom';
import { BuyerDashboardLayout } from '@/app/layouts/BaseDashboardLayout';
import { Home, Heart, ShoppingBag, User, Settings } from 'lucide-react';

export function BuyerLayout() {
    return <Outlet />;
}

export default BuyerLayout;


