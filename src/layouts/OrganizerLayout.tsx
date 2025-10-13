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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      {!isLoginPage && !isRegisterPage && !isForgotPasswordPage && !isResetPasswordPage && isAuthenticated && (
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 sm:py-0 sm:h-20 space-y-4 sm:space-y-0">
              {/* Mobile: Stack vertically, Desktop: Horizontal */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-black hover:bg-gray-100/80 transition-all duration-200 rounded-xl px-3 py-2 text-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
                <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
                <div className="flex-1 sm:flex-none">
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                    Organizer Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    Manage your events and tickets
                  </p>
                </div>
              </div>
              
              {/* Logout button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto">
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    onClick={logout}
                    className="inline-flex items-center gap-2 border-gray-300 text-black hover:bg-gray-50 hover:border-gray-300 rounded-xl h-9 sm:h-10 px-3 sm:px-4"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </Button>
                </div>
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