import React from 'react';
import { Outlet } from 'react-router-dom';
import { OrganizerDashboardLayout } from '@/layouts/BaseDashboardLayout';
import { Home, Calendar, Ticket, BarChart3, Settings } from 'lucide-react';

export function OrganizerLayout() {
  const navigationItems = [
    { label: 'Dashboard', path: '/organizer/dashboard', icon: Home },
    { label: 'Events', path: '/organizer/events', icon: Calendar },
    { label: 'Tickets', path: '/organizer/tickets', icon: Ticket },
    { label: 'Analytics', path: '/organizer/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/organizer/settings', icon: Settings },
  ];

  return (
    <OrganizerDashboardLayout
      title="Organizer Dashboard"
      subtitle="Manage your events and tickets"
      showSidebar={true}
      navigationItems={navigationItems}
      showBackButton={true}
      backButtonPath="/"
      backButtonLabel="Back to Home"
    >
      <Outlet />
    </OrganizerDashboardLayout>
  );
}