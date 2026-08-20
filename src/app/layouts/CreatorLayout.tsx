import React from 'react';
import { BaseDashboardLayout } from './BaseDashboardLayout';
import { LayoutDashboard, Share2, DollarSign, Award } from 'lucide-react';

export function CreatorLayout() {
  const creatorNavItems = [
    { label: 'Dashboard', path: '/creator/dashboard', icon: LayoutDashboard },
    { label: 'Affiliate Links', path: '/creator/links', icon: Share2 },
    { label: 'Earnings', path: '/creator/earnings', icon: DollarSign },
    { label: 'Badges', path: '/creator/badges', icon: Award },
  ];

  return (
    <BaseDashboardLayout
      role="creator"
      title="Creator Hub"
      subtitle="Track commissions, affiliate performance, and rewards"
      navigationItems={creatorNavItems}
    />
  );
}
