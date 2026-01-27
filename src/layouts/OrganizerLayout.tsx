import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useOrganizerAuth } from '@/contexts/OrganizerAuthContext';

export function OrganizerLayout() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useOrganizerAuth();
  const isLoginPage = location.pathname === '/organizer/login';
  const isRegisterPage = location.pathname === '/organizer/register';
  const isForgotPasswordPage = location.pathname === '/organizer/forgot-password';
  const isResetPasswordPage = location.pathname === '/organizer/reset-password';
  const isTermsPage = location.pathname === '/organizer/terms';
  const isAuthenticated = localStorage.getItem('organizerToken') !== null;

  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Header */}
      {!isLoginPage && !isRegisterPage && !isForgotPasswordPage && !isResetPasswordPage && isAuthenticated && (
        <header className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative flex items-center justify-between h-20">
              {/* Left: Back Button */}
              <div className="flex-1 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-xl px-3 py-2 text-sm -ml-3"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>

              {/* Center: Title */}
              <div className="absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[50%]">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  Organizer Dashboard
                </h1>
                <p className="hidden sm:block text-xs sm:text-sm text-gray-400 font-medium truncate">
                  Manage your events and tickets
                </p>
              </div>

              {/* Right: Logout */}
              <div className="flex-1 flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={logout}
                  className="inline-flex items-center gap-2 border-white/10 text-white hover:bg-white/5 hover:border-white/20 rounded-xl h-9 sm:h-10 px-3 sm:px-4 -mr-3"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Content */}
      <main className="flex-1 relative overflow-y-auto focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}