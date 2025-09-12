import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/api';

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
  const [token, setToken] = useState<string | null>(localStorage.getItem('organizerToken'));
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

  // Token management functions
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = localStorage.getItem('organizerToken');
      if (!token) {
        return null;
      }
      
      // Verify token is still valid by making a test request
      await api.get('/organizers/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return token;
    } catch (error) {
      console.error('Token validation failed:', error);
      
      // Clear invalid token
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
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
      const response = await api.patch('/organizers/me', updates);
      
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

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const token = await getToken();
        
        if (!token) {
          // No valid token found, user is not authenticated
          return;
        }
        
        // Token is valid, fetch organizer data
        const response = await api.get('/organizers/me');
        
        // Server response is in format: { status: 'success', data: { organizer: {...} } }
        const { data } = response.data;
        const { organizer } = data;
        
        if (!organizer) {
          throw new Error('No organizer data returned');
        }
        
        // Update auth state with the organizer data
        setOrganizer(organizer);
        setToken(token);
        
        // Set auth header for subsequent requests
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
      } catch (error) {
        console.error('Authentication check failed:', error);
        
        // Clear any invalid auth state
        localStorage.removeItem('organizerToken');
        delete api.defaults.headers.common['Authorization'];
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
  }, [getToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Clear any existing auth data
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
      
      // Make login request
      const response = await api.post('/organizers/login', { 
        email: email.trim().toLowerCase(),
        password 
      });
      
      // Extract token and organizer from response
      const { data } = response.data;
      const { organizer, token } = data;
      
      if (!token) {
        throw new Error('No authentication token received');
      }
      
      // Store token and update auth state
      localStorage.setItem('organizerToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setOrganizer(organizer);
      setToken(token);
      
      // Show success message
      toast.success('Successfully logged in!');
      
      return organizer;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Clear any partial auth state
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
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
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
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
      
      // Clear any existing auth data
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
      
      // Prepare registration data
      const registrationData = {
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
        passwordConfirm: data.passwordConfirm
      };
      
      // Call the register API
      const response = await api.post('/organizers/register', registrationData);
      
      // Extract token and organizer from response
      const { data: responseData } = response.data;
      const { token, organizer } = responseData;
      
      if (!token || !organizer) {
        throw new Error('Invalid response from server');
      }
      
      // Store token and update auth state
      localStorage.setItem('organizerToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setOrganizer(organizer);
      setToken(token);
      
      // Show success message
      toast.success('Registration successful! You are now logged in.');
      
      return organizer;
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Clear any partial auth state
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
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
      // Clear auth data
      localStorage.removeItem('organizerToken');
      delete api.defaults.headers.common['Authorization'];
      
      // Reset state immediately
      setOrganizer(null);
      setToken(null);
      setError(null);
      
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
      await api.post('/organizers/forgot-password', { 
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
      await api.post(`/organizers/reset-password/${token}`, { 
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
