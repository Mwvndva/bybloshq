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

  // Handle authentication errors
  useEffect(() => {
    if (error && !isLoading) {
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
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Verifying your session...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
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

  // User is authenticated, render the children
  return <>{children}</>;
}
