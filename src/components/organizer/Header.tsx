import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, LogOut, User } from 'lucide-react';
import { useOrganizerAuth } from '@/contexts/OrganizerAuthContext';

export function Header() {
  const { organizer, logout } = useOrganizerAuth();

  return (
    <header className="fixed w-full bg-black border-b border-gray-200 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-600 lg:hidden"
              aria-controls="sidebar"
              aria-expanded="false"
              onClick={() => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                  sidebar.classList.toggle('-translate-x-full');
                  sidebar.classList.toggle('lg:translate-x-0');
                }
              }}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="hidden lg:ml-6 lg:flex lg:items-center lg:space-x-4">
              <Link to="/" className="text-gray-700 hover:text-gray-900">
                <span className="font-bold text-xl">Byblos</span>
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-sm font-medium text-gray-500">Organizer Dashboard</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="hidden sm:inline-flex items-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
