import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import secureApi from '@/lib/secure-api';

export interface AuthError extends Error {
  description?: string;
  isAuthError?: boolean;
}

export interface Organizer {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  is_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string | null;
}

export interface AuthContextType {
  organizer: Organizer | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<Organizer | void>;
  register: (data: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    passwordConfirm: string;
  }) => Promise<Organizer | void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, password: string, passwordConfirm: string) => Promise<boolean>;
  updateOrganizer: (updates: Partial<Organizer>) => Promise<Organizer>;
  clearError: () => void;
  getToken: () => Promise<string | null>;
}

export const OrganizerAuthContext = createContext<AuthContextType | undefined>(undefined);



interface OrganizerAuthProviderProps {
  children: ReactNode;
}

export const OrganizerAuthProvider = ({ children }: OrganizerAuthProviderProps) => {
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [token, setToken] = useState<string | null>(null); // Remove localStorage access
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Define the type for the location state
  interface LocationState {
    from?: {
      pathname: string;
    };
  }

  // Use the router hooks with a check for the Router context
  let navigate: ReturnType<typeof useNavigate>;
  let location: ReturnType<typeof useLocation>;

  try {
    // These will throw if used outside of a Router context
    navigate = useNavigate();
    location = useLocation();
  } catch (error) {
    // Fallback implementation when not in a Router context
    console.warn('Router context not available, using fallback navigation');
    
    // Create a simple navigate function that uses window.location
    navigate = ((to: string, options?: { replace?: boolean }) => {
      console.warn('Fallback navigation to:', to);
      if (options?.replace) {
        window.location.replace(to);
      } else {
        window.location.href = to;
      }
    }) as any;
    
    // Create a simple location object
    location = {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: null,
      key: ''
    } as any;
  }

  // Token management functions - now uses cookies instead of localStorage
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      // For HTTP-only cookies, we need to make a request to verify authentication
      // The token will be automatically sent via cookies
      await secureApi.get('/organizers/me');
      
      // If the request succeeds, we're authenticated
      return 'authenticated'; // Return placeholder token
    } catch (error) {
      console.error('Token validation failed:', error);
      
      // Clear auth state if authentication fails
      setOrganizer(null);
      setToken(null);
      
      return null;
    }
  }, [setOrganizer, setToken]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // Update organizer data in context and sync with API
  const updateOrganizer = useCallback(async (updates: Partial<Organizer>) => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (!organizer) {
        throw new Error('No organizer data available');
      }
      
      // Make API call to update organizer
      const response = await secureApi.patch('/organizers/me', updates);
      
      // Update local state with the updated organizer data
      const updatedOrganizer = { ...organizer, ...updates };
      setOrganizer(updatedOrganizer);
      
      // Show success message
      toast.success('Profile updated successfully');
      
      return updatedOrganizer;
    } catch (error: any) {
      console.error('Update organizer error:', error);
      
      // Format error message
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Create a new error with consistent format
      const updateError = new Error(errorMessage);
      setError(updateError);
      
      // Show error toast
      toast.error(errorMessage);
      
      // Re-throw the error for component-level handling
      throw updateError;
    } finally {
      setIsLoading(false);
    }
  }, [organizer, setError, setIsLoading, toast]);

  // Check if user is logged in on mount (only for organizer routes)
  useEffect(() => {
    const location = window.location;
    const isOrganizerRoute = location.pathname.startsWith('/organizer');
    
    // Only check authentication if we're on an organizer route
    if (!isOrganizerRoute) {
      setIsLoading(false);
      return;
    }
    
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Try to verify authentication via cookies
        const response = await secureApi.get('/organizers/me');
        
        // Server response is in format: { status: 'success', data: { organizer: {...} } }
        const responseData = response.data as { status: string; data: { organizer: Organizer } };
        const { organizer } = responseData.data;
        
        if (!organizer) {
          throw new Error('No organizer data returned');
        }
        
        // Update auth state with the organizer data
        setOrganizer(organizer);
        setToken('authenticated'); // Placeholder token for cookie-based auth
        
        // No need to set Authorization header when using cookies
        
      } catch (error) {
        console.error('Authentication check failed:', error);
        
        // Clear any invalid auth state
        setOrganizer(null);
        setToken(null);
        
        // Only show error if it's not a 401 (unauthorized) error
        const isUnauthorized = (error as any)?.response?.status === 401;
        if (!isUnauthorized) {
          const errorMessage = 'Failed to verify your session. Please log in again.';
          const authError = new Error(errorMessage);
          setError(authError);
          toast.error(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Make login request - cookies will be set automatically
      const response = await secureApi.post('/organizers/login', { 
        email: email.trim().toLowerCase(),
        password 
      });
      
      // After successful login, fetch organizer data separately
      const organizerResponse = await secureApi.get('/organizers/me');
      const responseData = organizerResponse.data as { status: string; data: { organizer: Organizer } };
      const { organizer } = responseData.data;
      
      if (!organizer) {
        throw new Error('Failed to fetch organizer data after login');
      }
      
      // Update auth state
      setOrganizer(organizer);
      setToken('authenticated'); // Placeholder for cookie-based auth
      
      // Show success message
      toast.success('Successfully logged in!');
      
      return organizer;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Clear any partial auth state
      setOrganizer(null);
      setToken(null);
      
      // Format error message based on error type
      let errorMessage = 'Invalid email or password. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your internet connection and try again.';
      }
      
      // Show error toast
      toast.error(errorMessage);
      
      // Clear auth state
      setOrganizer(null);
      setToken(null);
      
      // Re-throw the error for component-level handling
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [setError, setOrganizer, setToken, setIsLoading, toast]);

  const register = useCallback(async (data: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    passwordConfirm: string;
  }) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Prepare registration data
      const registrationData = {
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
        passwordConfirm: data.passwordConfirm
      };
      
      // Call the register API - cookies will be set automatically
      const response = await secureApi.post('/organizers/register', registrationData);
      
      // After successful registration, fetch organizer data separately
      const organizerResponse = await secureApi.get('/organizers/me');
      const responseData = organizerResponse.data as { status: string; data: { organizer: Organizer } };
      const { organizer } = responseData.data;
      
      if (!organizer) {
        throw new Error('Failed to fetch organizer data after registration');
      }
      
      // Update auth state
      setOrganizer(organizer);
      setToken('authenticated'); // Placeholder for cookie-based auth
      
      // Show success message
      toast.success('Registration successful! You are now logged in.');
      
      return organizer;
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Clear any partial auth state
      setOrganizer(null);
      setToken(null);
      
      // Format error message
      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response) {
        if (error.response.status === 400 && error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data?.errors) {
          // Handle validation errors
          const firstError = Object.values(error.response.data.errors)[0];
          errorMessage = Array.isArray(firstError) ? firstError[0] : 'Validation error';
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      // Create a new error with consistent format
      const registrationError = new Error(errorMessage);
      (registrationError as any).isAuthError = true;
      setError(registrationError);
      
      // Show error toast
      toast.error(errorMessage);
      
      // Re-throw the error for component-level handling
      throw registrationError;
    } finally {
      setIsLoading(false);
    }
  }, [setError, setOrganizer, setToken, setIsLoading, toast]);

  const logout = useCallback(() => {
    try {
      // Clear auth state
      setOrganizer(null);
      setToken(null);
      setError(null);
      
      // Call logout endpoint to clear server-side cookies
      secureApi.post('/organizers/logout').catch(() => {
        // Ignore logout API errors since we're clearing client state anyway
      });
      
      // Show success message
      toast.success('Successfully logged out');
      
      // Use a small delay to ensure state is updated before navigation
      setTimeout(() => {
        navigate('/organizer/login', { replace: true });
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
    }
  }, [setError, setOrganizer, setToken, setIsLoading, navigate, toast, getToken]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Call the forgot password API
      await secureApi.post('/organizers/forgot-password', { 
        email: email.trim().toLowerCase() 
      });
      
      // Show success message (always show the same message for security)
      toast.success('If an account exists with this email, you will receive a password reset link.');
      
      return true;
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      // Format error message
      let errorMessage = 'Failed to process your request. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      // Create a new error with consistent format
      const passwordError = new Error(errorMessage);
      (passwordError as any).isAuthError = true;
      setError(passwordError);
      
      // Show error toast
      toast.error(errorMessage);
      
      // Re-throw the error for component-level handling
      throw passwordError;
    } finally {
      setIsLoading(false);
    }
  }, [setError, setIsLoading, toast]);

  const resetPassword = useCallback(async (token: string, password: string, passwordConfirm: string): Promise<boolean> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Call the reset password API
      await secureApi.post(`/organizers/reset-password/${token}`, { 
        password, 
        passwordConfirm 
      });
      
      // Show success message
      toast.success('Password reset successful! You can now log in with your new password.');
      
      return true;
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      // Format error message
      let errorMessage = 'Failed to reset password. The link may be invalid or expired.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      // Create a new error with consistent format
      const passwordError = new Error(errorMessage);
      (passwordError as any).isAuthError = true;
      setError(passwordError);
      
      // Show error toast
      toast.error(errorMessage);
      
      // Re-throw the error for component-level handling
      throw passwordError;
    } finally {
      setIsLoading(false);
    }
  }, [setError, setIsLoading, toast]);



  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    organizer,
    token,
    isAuthenticated: !!token,
    isLoading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateOrganizer,
    clearError,
    getToken,
  }), [
    organizer, 
    token, 
    isLoading, 
    error,
    login, 
    register, 
    logout, 
    forgotPassword, 
    resetPassword, 
    updateOrganizer,
    clearError,
    getToken,
  ]);

  return (
    <OrganizerAuthContext.Provider value={value}>
      {!isLoading && children}
    </OrganizerAuthContext.Provider>
  );
};

export const useOrganizerAuth = () => {
  const context = useContext(OrganizerAuthContext);
  if (context === undefined) {
    throw new Error('useOrganizerAuth must be used within an OrganizerAuthProvider');
  }
  return context;
};
