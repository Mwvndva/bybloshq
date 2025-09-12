import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BuyerRouteProps {
  children?: React.ReactNode;
}

export function BuyerRoute({ children }: BuyerRouteProps) {
  const { isAuthenticated, isLoading } = useBuyerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    console.log('🔐 [BuyerRoute] Auth state:', { isAuthenticated, isLoading });
    
    // Skip if still loading
    if (isLoading) {
      console.log('🔄 [BuyerRoute] Still loading auth state...');
      return;
    }

    // If not authenticated, handle redirect to login
    if (!isAuthenticated) {
      console.log('🚫 [BuyerRoute] User not authenticated');
      
      // Don't redirect if we're already on a public route
      const publicRoutes = ['/buyer/login', '/buyer/register', '/buyer/forgot-password'];
      const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));
      
      if (isPublicRoute) {
        console.log('ℹ️ [BuyerRoute] Already on a public route, no redirect needed');
        return;
      }
      
      // Save the current location for redirecting back after login
      const currentPath = location.pathname + location.search;
      console.log('📍 [BuyerRoute] Saving current path for redirect:', currentPath);
      
      // Only save if it's not the root path
      if (currentPath !== '/') {
        localStorage.setItem('post_login_redirect', currentPath);
      } else {
        // Default to dashboard if on root
        localStorage.setItem('post_login_redirect', '/buyer/dashboard');
      }
      
      console.log('🔙 [BuyerRoute] Redirecting to login page');
      navigate('/buyer/login', { 
        replace: true,
        state: { 
          from: { 
            pathname: location.pathname,
            search: location.search
          }
        }
      });
      return;
    }

    // If authenticated and this is the first check
    if (!initialCheckDone) {
      console.log('✅ [BuyerRoute] Initial auth check - user is authenticated');
      setInitialCheckDone(true);
      
      // Check for a post-login redirect in localStorage
      const savedRedirect = localStorage.getItem('post_login_redirect');
      
      if (savedRedirect) {
        console.log('🔄 [BuyerRoute] Found saved redirect path:', savedRedirect);
        localStorage.removeItem('post_login_redirect');
        
        // Ensure we don't redirect to the same path
        if (savedRedirect !== window.location.pathname) {
          console.log('🔄 [BuyerRoute] Processing post-login redirect to:', savedRedirect);
          
          // Small delay to ensure the UI is ready
          setTimeout(() => {
            window.location.href = savedRedirect;
          }, 100);
          return;
        }
      }
    }
  }, [isAuthenticated, isLoading, location, navigate, initialCheckDone]);

  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated, don't render anything (we're redirecting in the effect)
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render the protected content
  console.log(' [BuyerRoute] User authenticated, rendering content');
  return children || <Outlet />;
}
