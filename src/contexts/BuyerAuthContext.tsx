import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import buyerApi from '@/api/buyerApi';
import { toast } from 'sonner';

interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  location?: string;
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
    phone: string;
    password: string;
    confirmPassword: string;
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
    console.group('🔍 [BuyerAuth] checkAuth');
    console.log('1. Checking authentication status...');
    console.log('   Current path:', window.location.pathname);
    console.log('   Current search:', window.location.search);
    
    const token = localStorage.getItem('buyer_token');
    console.log('2. Token in localStorage:', token ? `exists (${token.substring(0, 10)}...)` : 'not found');
    
    if (!token) {
      console.log('🔐 3. No token found, user is not authenticated');
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      
      // Check if we're on a protected route
      const publicRoutes = ['/buyer/login', '/buyer/register', '/buyer/forgot-password', '/buyer/reset-password'];
      const isProtectedRoute = location.pathname.startsWith('/buyer') && 
                             !publicRoutes.some(route => location.pathname.startsWith(route));
      
      console.log('4. Route check:');
      console.log('   - Is protected route:', isProtectedRoute);
      console.log('   - Current path:', location.pathname);
      
      if (isProtectedRoute) {
        const redirectPath = location.pathname + location.search;
        console.log('🔄 5. Protected route detected, saving redirect and going to login');
        console.log('   - Saving redirect path:', redirectPath);
        
        localStorage.setItem('post_login_redirect', redirectPath);
        
        console.log('6. Navigating to login...');
        navigate('/buyer/login', { 
          replace: true,
          state: { from: { pathname: location.pathname, search: location.search } }
        });
      } else {
        console.log('ℹ️ 5. Public route, no redirect needed');
      }
      
      console.groupEnd();
      return;
    }

    try {
      console.log('🔑 3. Token found, verifying with server...');
      
      // Verify token with the server
      console.log('4. Calling buyerApi.getProfile()...');
      const userData = await buyerApi.getProfile();
      console.log('✅ 5. Token is valid, user is authenticated');
      console.log('   User data:', { 
        id: userData?.id,
        email: userData?.email,
        fullName: userData?.fullName 
      });
      
      // Update state
      console.log('6. Updating auth state...');
      setUser(userData);
      setIsAuthenticated(true);
      
      // Handle redirection if on login page
      if (location.pathname === '/buyer/login') {
        console.log('7. On login page, checking for redirect...');
        const savedRedirect = localStorage.getItem('post_login_redirect');
        const redirectPath = savedRedirect || '/buyer/dashboard';
        
        console.log('   - Saved redirect:', savedRedirect);
        console.log('   - Will redirect to:', redirectPath);
        
        if (savedRedirect) {
          console.log('   - Removing saved redirect from localStorage');
          localStorage.removeItem('post_login_redirect');
        }
        
        // Small delay to ensure state is updated
        console.log('8. Preparing to navigate...');
        setTimeout(() => {
          console.group('🔄 [BuyerAuth] Auto-redirect');
          console.log('1. Current URL:', window.location.href);
          console.log('2. Target path:', redirectPath);
          
          if (window.location.pathname + window.location.search === redirectPath) {
            console.log('3. Already on target path, reloading page');
            window.location.reload();
          } else {
            console.log('3. Navigating to:', redirectPath);
            window.location.href = redirectPath;
          }
          
          console.groupEnd();
        }, 100);
      }
    } catch (error) {
      console.group('❌ [BuyerAuth] Authentication Error');
      console.error('1. Token verification failed:', error);
      
      // Clear invalid token
      console.log('2. Removing invalid token from localStorage');
      localStorage.removeItem('buyer_token');
      
      // Update state
      console.log('3. Updating auth state to unauthenticated');
      setIsAuthenticated(false);
      setUser(null);
      
      // Check if we're on a protected route
      const publicRoutes = ['/buyer/login', '/buyer/register', '/buyer/forgot-password', '/buyer/reset-password'];
      const isProtectedRoute = location.pathname.startsWith('/buyer') && 
                             !publicRoutes.some(route => location.pathname.startsWith(route));
      
      console.log('4. Route check:');
      console.log('   - Is protected route:', isProtectedRoute);
      console.log('   - Current path:', location.pathname);
      
      if (isProtectedRoute) {
        const redirectPath = location.pathname + location.search;
        console.log('5. Protected route detected, saving current path and redirecting to login');
        console.log('   - Saving redirect path:', redirectPath);
        
        localStorage.setItem('post_login_redirect', redirectPath);
        
        console.log('6. Navigating to login page...');
        navigate('/buyer/login', { 
          replace: true,
          state: { 
            from: { 
              pathname: location.pathname,
              search: location.search 
            },
            authError: 'Your session has expired. Please log in again.'
          }
        });
      } else {
        console.log('ℹ️ 5. Public route, no redirect needed');
      }
      
      console.groupEnd();
    } finally {
      console.log('7. Authentication check complete');
      setIsLoading(false);
      console.groupEnd(); // Close the checkAuth group
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    console.group('🔑 [BuyerAuth] Login Flow');
    console.log('1. Login function called with email:', email);
    console.log('   Current path:', window.location.pathname);
    console.log('   Current search:', window.location.search);
    
    // Clear any existing errors
    setIsLoading(true);
      
    try {
      console.log('2. Checking credentials...');
      if (!email || !password) {
        console.error('   ❌ Email and password are required');
        throw new Error('Email and password are required');
      }
      
      console.log('3. Calling buyerApi.login...');
      console.log('   API URL:', import.meta.env.VITE_API_URL || 'http://localhost:3002/api');
      console.log('3.1. Making API call...');
      
      const response = await buyerApi.login({ email, password });
      console.log('✅ 3.2. Login API call successful');
      
      // Log the complete response for debugging
      console.log('   Full response:', JSON.stringify(response, null, 2));
      
      if (!response) {
        throw new Error('No response received from server');
      }
      
      const { buyer, token } = response;
      
      console.log('   Response details:', {
        hasBuyer: !!buyer,
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
        buyerId: buyer?.id || 'none'
      });
      
      if (!token) {
        console.error('❌ No token received in login response');
        throw new Error('Authentication failed: No token received');
      }
      
      // Store the token in localStorage for verification
      localStorage.setItem('buyer_token', token);
      console.log('✅ Token stored in localStorage');
      
      // Get the buyer profile to ensure the token works
      console.log('4. Fetching buyer profile with the new token...');
      const buyerProfile = await buyerApi.getProfile();
      console.log('✅ Buyer profile:', buyerProfile);
      
      // Update state
      console.log('5. Updating auth state...');
      if (buyerProfile) {
        setUser(buyerProfile);
        setIsAuthenticated(true);
        console.log('   ✅ Auth state updated');
      } else {
        console.warn('   ⚠️ No buyer data received');
        throw new Error('Failed to load user profile');
      }
      
      // Get the redirect path
      console.log('6. Determining redirect path...');
      let redirectPath = '/buyer/dashboard'; // Default path
      
      // Check for saved redirect path in localStorage
      const savedPath = localStorage.getItem('post_login_redirect');
      if (savedPath) {
        console.log('   Found saved redirect path in localStorage:', savedPath);
        redirectPath = savedPath;
        localStorage.removeItem('post_login_redirect');
      } else if (location.state?.from?.pathname) {
        console.log('   Using redirect from location state:', location.state.from.pathname);
        redirectPath = location.state.from.pathname;
      } else {
        console.log('   No saved redirect, using default:', redirectPath);
      }
      
      // Ensure the path is absolute and starts with /buyer
      if (!redirectPath.startsWith('/buyer') && !redirectPath.startsWith('http')) {
        const newPath = `/buyer${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`;
        console.log('7.1 Normalizing path:', redirectPath, '→', newPath);
        redirectPath = newPath;
      }
      
      console.log('7. Final navigation target:', redirectPath);
      
      // Show success message
      console.log('8. Showing success toast');
      toast.success('Welcome back!', {
        description: 'You have successfully logged in.',
        duration: 2000,
      });
      
      // Navigate to the target page
      console.log('9. Navigating to:', redirectPath);
      navigate(redirectPath, { 
        replace: true,
        state: { from: 'login' }
      });
      
    } catch (loginError: any) {
      console.group('❌ [BuyerAuth] Login Error');
      console.error('Login error:', loginError);
      
      let errorMessage = 'An error occurred during login';
      
      if (loginError.response?.status === 403) {
        errorMessage = 'Please verify your email before logging in.';
        toast.error('Account Not Verified', {
          description: errorMessage,
          duration: 5000,
        });
      } else if (loginError.response?.status === 429) {
        errorMessage = 'Too many login attempts. Please try again later.';
        toast.error('Too Many Attempts', {
          description: errorMessage,
          duration: 7000,
        });
      } else {
        errorMessage = loginError.response?.data?.message || errorMessage;
        toast.error('Login Failed', {
          description: errorMessage,
          duration: 5000,
        });
      }
      
      console.groupEnd();
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
    phone: string;
    password: string;
    confirmPassword: string;
    city: string;
    location: string;
  }) => {
    setIsLoading(true);
    try {
      const { buyer, token } = await buyerApi.register(userData);
      localStorage.setItem('buyer_token', token);
      setUser(buyer);
      setIsAuthenticated(true);
      navigate('/buyer/dashboard', { replace: true });
      toast.success('Account created!', {
        description: 'Your account has been successfully created.',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Registration failed:', error);
      
      if (error.response?.status === 400) {
        // Handle validation errors
        const errorMessage = error.response?.data?.message || 'Please check your information and try again.';
        toast.error('Validation Error', {
          description: errorMessage,
          duration: 5000,
        });
      } else if (error.response?.status === 409) {
        // Handle duplicate email/phone
        toast.error('Account Exists', {
          description: 'An account with this email or phone number already exists. Please log in instead.',
          duration: 6000,
        });
      } else if (error.response?.status === 500) {
        // Handle server errors
        toast.error('Server Error', {
          description: 'Something went wrong on our end. Please try again later.',
          duration: 5000,
        });
      } else {
        // Handle other errors
        toast.error('Registration Failed', {
          description: error.response?.data?.message || 'Failed to create account. Please try again.',
          duration: 5000,
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
      
      if (error.response?.status === 400) {
        toast.error('Invalid Request', {
          description: 'Please provide a valid email address.',
          duration: 5000,
        });
      } else if (error.response?.status === 429) {
        toast.error('Too Many Requests', {
          description: 'Please wait before requesting another password reset.',
          duration: 6000,
        });
      } else {
        toast.error('Reset Link Not Sent', {
          description: error.response?.data?.message || 'Failed to send reset link. Please try again later.',
          duration: 5000,
        });
      }
      return false;
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      try {
        await buyerApi.resetPassword(token, newPassword);
        toast.success('Password updated', {
          description: 'Your password has been successfully updated. You can now log in with your new password.',
          duration: 4000,
        });
        navigate('/buyer/login');
      } catch (error: any) {
        console.error('Reset password failed:', error);
        
        if (error.response?.status === 400) {
          // Invalid token or weak password
          toast.error('Invalid Request', {
            description: error.response?.data?.message || 'Please ensure your new password meets the requirements.',
            duration: 5000,
          });
        } else if (error.response?.status === 401) {
          // Invalid or expired token
          toast.error('Link Expired', {
            description: 'This password reset link has expired. Please request a new one.',
            duration: 6000,
          });
        } else {
          // Other errors
          toast.error('Password Reset Failed', {
            description: error.response?.data?.message || 'Failed to reset password. Please try again.',
            duration: 5000,
          });
        }
        throw error;
      }
    },
    [navigate]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('buyer_token');
    setUser(null);
    setIsAuthenticated(false);
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
