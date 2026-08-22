import React from 'react';
import { BaseDashboardLayout } from './BaseDashboardLayout';
import { LayoutDashboard, Truck, MapPin, PackageCheck } from 'lucide-react';

export function MzigoLayout() {
  const mzigoNavItems = [
    { label: 'Dashboard', path: '/mzigo/dashboard', icon: LayoutDashboard },
    { label: 'Active Deliveries', path: '/mzigo/deliveries', icon: Truck },
    { label: 'Hub Station', path: '/mzigo/hub', icon: MapPin },
    { label: 'Completed Jobs', path: '/mzigo/history', icon: PackageCheck },
  ];

  return (
    <BaseDashboardLayout
      role="logistics"
      title="Mzigo Logistics Fleet"
      subtitle="Live delivery dispatch, hub operations, and tracking"
      navigationItems={mzigoNavItems}
    />
  );
}
