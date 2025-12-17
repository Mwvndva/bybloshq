import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useOrganizerAuth } from '@/contexts/OrganizerAuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, error } = useOrganizerAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Only handle authentication errors if we're actually on a protected route
  useEffect(() => {
    if (error && !isLoading && location.pathname.startsWith('/organizer')) {
      console.error('Authentication error:', error);
      
      // Show error toast
      toast.error('Your session has expired. Please log in again.');
      
      // Clear any invalid auth state
      localStorage.removeItem('organizerToken');
      
      // Redirect to login with the current location as the return URL
      navigate('/organizer/login', { 
        state: { from: location },
        replace: true 
      });
    }
  }, [error, isLoading, location, navigate]);

  // Show loading state while checking authentication
  if (isLoading && location.pathname.startsWith('/organizer')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Verifying your session...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated and we're on a protected route
  if (!isAuthenticated && location.pathname.startsWith('/organizer')) {
    // Store the current location to redirect back after login
    return (
      <Navigate 
        to="/organizer/login" 
        state={{ 
          from: location,
          message: 'Please log in to access this page'
        }} 
        replace 
      />
    );
  }

  // User is authenticated or we're not on a protected route, render the children
  return <>{children}</>;
}
