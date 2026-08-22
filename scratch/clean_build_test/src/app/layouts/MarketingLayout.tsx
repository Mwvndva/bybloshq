import React from 'react';
import { BaseDashboardLayout } from './BaseDashboardLayout';
import { LayoutDashboard, Megaphone, TrendingUp, BarChart3 } from 'lucide-react';

export function MarketingLayout() {
  const marketingNavItems = [
    { label: 'Overview', path: '/admin/marketing', icon: LayoutDashboard },
    { label: 'Campaigns', path: '/admin/marketing/campaigns', icon: Megaphone },
    { label: 'Referrals', path: '/admin/marketing/referrals', icon: TrendingUp },
    { label: 'Analytics', path: '/admin/marketing/analytics', icon: BarChart3 },
  ];

  return (
    <BaseDashboardLayout
      role="marketing"
      title="Marketing & Growth"
      subtitle="Campaign analytics, referral programs, and promotions"
      navigationItems={marketingNavItems}
    />
  );
}
