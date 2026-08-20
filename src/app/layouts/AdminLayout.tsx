import React from 'react';
import { BaseDashboardLayout } from './BaseDashboardLayout';
import { LayoutDashboard, Users, ShoppingBag, ShieldCheck, Settings } from 'lucide-react';

export function AdminLayout() {
  const adminNavItems = [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Security', path: '/admin/security', icon: ShieldCheck },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <BaseDashboardLayout
      role="admin"
      title="Admin Control Center"
      subtitle="Platform governance, security, and operations"
      navigationItems={adminNavItems}
    />
  );
}
