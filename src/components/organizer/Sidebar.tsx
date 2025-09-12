import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Calendar, Ticket, Users, Settings, LogOut, FileText } from 'lucide-react';
import { useOrganizerAuth } from '@/contexts/OrganizerAuthContext';

const navigation = [
  { name: 'Dashboard', href: '/organizer/dashboard', icon: LayoutDashboard },
  { name: 'Events', href: '/organizer/events', icon: Calendar },
  { name: 'Tickets', href: '/organizer/tickets', icon: Ticket },
  { name: 'Settings', href: '/organizer/settings', icon: Settings },
  { name: 'Terms & Conditions', href: '/organizer/terms', icon: FileText },
];

export function Sidebar() {
  const { organizer, logout } = useOrganizerAuth();
  const location = useLocation();

  return (
    <div
      id="sidebar"
      className="fixed inset-y-0 left-0 z-20 w-64 -translate-x-full transform bg-black border-r border-gray-200 transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
      aria-label="Sidebar"
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex h-16 flex-shrink-0 items-center px-6">
          <span className="text-xl font-bold text-gray-900">Byblos</span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0 h-6 w-6'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
          <div className="group block w-full flex-shrink-0">
            <div className="flex items-center">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-500">
                  <span className="font-medium leading-none text-white">
                    {organizer?.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {organizer?.full_name}
                </p>
                <button
                  onClick={logout}
                  className="text-xs font-medium text-gray-500 group-hover:text-gray-700 flex items-center"
                >
                  <LogOut className="mr-1 h-3 w-3" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
