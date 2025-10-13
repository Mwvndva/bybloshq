import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '@/api/adminApi';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  console.log('Initializing AdminAuthProvider');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check authentication status
  const checkAuth = useCallback(async () => {
    console.log('Checking authentication status...');
    try {
      const isAuth = adminApi.isAuthenticated();
      console.log('isAuthenticated:', isAuth);
      setIsAuthenticated(isAuth);
      return isAuth;
    } catch (error) {
      console.error('Auth check failed:', error);
      const errorMsg = 'Failed to check authentication status';
      console.error(errorMsg, error);
      setError(errorMsg);
      setIsAuthenticated(false);
      return false;
    } finally {
      console.log('Auth check complete, setting loading to false');
      setLoading(false);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    console.log('Running initial auth check');
    checkAuth();
  }, [checkAuth]);

  // Handle login
  const login = useCallback(async (pin: string): Promise<boolean> => {
    console.log('Login attempt with PIN:', pin ? '***' : '(empty)');
    setLoading(true);
    setError(null);
    
    try {
      console.log('Calling adminApi.login()');
      const response = await adminApi.login(pin);
      console.log('Login response:', response);
      
      const success = !!response?.data?.token;
      console.log('Login success:', success);
      
      if (success) {
        console.log('Setting isAuthenticated to true');
        setIsAuthenticated(true);
        console.log('Navigating to /admin/dashboard');
        navigate('/admin/dashboard');
      } else {
        const errorMsg = response?.message || 'Invalid PIN. Please try again.';
        console.log('Login failed:', errorMsg);
        setError(errorMsg);
      }
      
      return success;
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      console.error('Setting login error:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      console.log('Login process complete, setting loading to false');
      setLoading(false);
    }
  }, [navigate]);

  // Handle logout
  const logout = useCallback(() => {
    console.log('Logging out...');
    adminApi.logout();
    console.log('Setting isAuthenticated to false');
    setIsAuthenticated(false);
    console.log('Navigating to /admin/login');
    navigate('/admin/login');
  }, [navigate]);

  // Context value
  const value = {
    isAuthenticated,
    login,
    logout,
    loading,
    error,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextType => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
