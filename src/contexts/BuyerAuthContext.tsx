import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import buyerApi from '@/api/buyerApi';
import { toast } from 'sonner';

interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  mobilePayment: string;
  whatsappNumber: string;
  city?: string;
  location?: string;
  refunds?: number;
  createdAt: string;
  updatedAt?: string;
}

interface BuyerAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    fullName: string;
    email: string;
    mobilePayment: string;
    whatsappNumber: string;
    password: string;
    confirmPassword: string;
    city: string;
    location: string;
  }) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const BuyerAuthContext = createContext<BuyerAuthContextType | undefined>(undefined);

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is authenticated on initial load
  const checkAuth = useCallback(async () => {
    // Skip auth check if we are on seller, organizer, admin routes, or the homepage
    // This prevents "Invalid User Role" errors when a seller/organizer is logged in
    const publicOrOtherRoleRoutes = [
      '/seller',
      '/organizer',
      '/admin',
      '/' // Homepage - could be visited by anyone
    ];

    const shouldSkipCheck = publicOrOtherRoleRoutes.some(route =>
      location.pathname === route || location.pathname.startsWith(route + '/')
    );

    if (shouldSkipCheck) {
      console.log('ℹ️ [BuyerAuth] Skipping checkAuth on non-buyer route:', location.pathname);
      setIsLoading(false);
      return;
    }

    // Check if user is authenticated on initial load
    // Just try to fetch profile, cookie will handle auth
    try {
      console.log('🔑 [BuyerAuth] Checking auth via cookie...');
      const userData = await buyerApi.getProfile();

      console.log('✅ Auth check successful');
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      // If we get "Invalid user role", it means we're authenticated as a different role
      // This is fine - just silently skip
      if (error.response?.status === 401 && error.response?.data?.message?.includes('Invalid user role')) {
        console.log('ℹ️ [BuyerAuth] User authenticated as different role, skipping buyer auth');
      } else {
        console.log('ℹ️ Auth check failed - user not logged in');
      }
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [location.pathname]); // Add location.pathname as dependency

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    console.group('🔑 [BuyerAuth] Login Flow');

    // Clear any existing errors
    setIsLoading(true);

    try {
      console.log('1. Calling buyerApi.login...');

      const response = await buyerApi.login({ email, password });
      console.log('✅ Login API call successful');

      if (!response) {
        throw new Error('No response received from server');
      }

      const { buyer } = response;

      // No token handling needed here, cookie is set automatically by server

      // Update state
      if (buyer) {
        setUser(buyer);
        setIsAuthenticated(true);
      } else {
        throw new Error('Failed to load user profile');
      }

      // Get the redirect path
      let redirectPath = '/buyer/dashboard'; // Default path

      // Check for saved redirect path in localStorage
      const savedPath = localStorage.getItem('post_login_redirect');
      if (savedPath) {
        redirectPath = savedPath;
        localStorage.removeItem('post_login_redirect');
      } else if (location.state?.from?.pathname) {
        redirectPath = location.state.from.pathname;
      }

      // Ensure the path is absolute and starts with /buyer
      if (!redirectPath.startsWith('/buyer') && !redirectPath.startsWith('http')) {
        const newPath = `/buyer${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`;
        redirectPath = newPath;
      }

      // Show success message
      toast.success('Welcome back!', {
        description: 'You have successfully logged in.',
        duration: 2000,
      });

      // Navigate to the target page
      navigate(redirectPath, {
        replace: true,
        state: { from: 'login' }
      });

    } catch (loginError: any) {
      console.error('Login error:', loginError);

      let errorMessage = 'An error occurred during login';

      if (loginError.response?.status === 403) {
        errorMessage = 'Please verify your email before logging in.';
        toast.error('Account Not Verified', { description: errorMessage });
      } else if (loginError.response?.status === 429) {
        errorMessage = 'Too many login attempts. Please try again later.';
        toast.error('Too Many Attempts', { description: errorMessage });
      } else {
        errorMessage = loginError.response?.data?.message || loginError.message || errorMessage;
        toast.error('Login Failed', { description: errorMessage });
      }

      throw loginError;
    } finally {
      setIsLoading(false);
      console.groupEnd();
    }
  },
    [
      navigate,
      location.state?.from?.pathname,
      setUser,
      setIsAuthenticated,
      setIsLoading
    ]
  );

  const register = useCallback(async (userData: {
    fullName: string;
    email: string;
    mobilePayment: string;
    whatsappNumber: string;
    password: string;
    confirmPassword: string;
    city: string;
    location: string;
  }) => {
    setIsLoading(true);
    try {
      // Ensure required fields are present
      if (!userData.fullName || !userData.email || !userData.mobilePayment || !userData.whatsappNumber || !userData.password || !userData.city || !userData.location) {
        throw new Error('Please fill in all required fields');
      }

      // If passwords don't match
      if (userData.password !== userData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const registrationData = {
        fullName: userData.fullName,
        email: userData.email,
        mobilePayment: userData.mobilePayment,
        whatsappNumber: userData.whatsappNumber,
        password: userData.password,
        confirmPassword: userData.confirmPassword,
        city: userData.city,
        location: userData.location
      };

      const { buyer } = await buyerApi.register(registrationData);

      // Cookie is set automatically
      setUser(buyer);
      setIsAuthenticated(true);

      // Redirect to dashboard
      navigate('/buyer/dashboard', { replace: true });

      // Show success message
      toast.success('Account created!', {
        description: 'Your account has been successfully created.',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Registration failed:', error);

      // Handle structured validation errors
      if (error.response?.status === 400 && error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          const firstError = validationErrors[0];
          toast.error(`${firstError.field}: ${firstError.message}`);
        } else {
          toast.error('Validation Error', { description: error.response.data.message });
        }
      } else {
        toast.error('Registration Failed', {
          description: error.message || 'Failed to create account.',
        });
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await buyerApi.forgotPassword(email);
      toast.success('Check your email', {
        description: 'If an account exists with this email, you will receive a password reset link.',
        duration: 5000,
      });
      return true;
    } catch (error: any) {
      console.error('Forgot password failed:', error);
      toast.error('Request Failed', { description: error.message });
      return false;
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      try {
        await buyerApi.resetPassword(token, newPassword);
        toast.success('Password updated', { description: 'You can now log in with your new password.' });
        navigate('/buyer/login');
      } catch (error: any) {
        console.error('Reset password failed:', error);
        toast.error('Reset Failed', { description: error.message });
        throw error;
      }
    },
    [navigate]
  );

  const logout = useCallback(() => {
    // Clear client state
    setUser(null);
    setIsAuthenticated(false);

    // We should ideally hit a logout endpoint to clear the cookie, but for now client-side clear is start.
    // TODO: Add logout endpoint call: await buyerApi.logout();

    navigate('/buyer/login');
    toast('Logged out', {
      description: 'You have been successfully logged out.',
      duration: 3000,
    });
  }, [navigate]);

  return (
    <BuyerAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </BuyerAuthContext.Provider>
  );
}

export const useBuyerAuth = (): BuyerAuthContextType => {
  const context = useContext(BuyerAuthContext);
  if (context === undefined) {
    throw new Error('useBuyerAuth must be used within a BuyerAuthProvider');
  }
  return context;
};
