import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import buyerApi from '@/api/buyerApi';
import { sellerApi } from '@/api/sellerApi';
import adminApi from '@/api/adminApi';
import apiClient from '@/lib/apiClient';
import { authStateManager } from '@/lib/authState';
import { clearAllAuthData } from '@/lib/authCleanup';

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'buyer' | 'seller' | 'admin';

// Base user interface with common fields
interface BaseUser {
    id: number;
    email: string;
    createdAt: string;
    updatedAt?: string;
}

// Role-specific profile types
export interface BuyerProfile extends BaseUser {
    fullName: string;
    phone: string;
    whatsappNumber: string;
    mobilePayment: string;
    city?: string;
    location?: string;
    fullAddress?: string;
    latitude?: number;
    longitude?: number;
    refunds?: number;
    hasEmail?: boolean;
}

export interface SellerProfile extends BaseUser {
    fullName: string;
    shopName: string;
    phone: string;
    whatsappNumber: string;
    city?: string;
    location?: string;
    hasPhysicalShop?: boolean;
    physicalAddress?: string;
    latitude?: number;
    longitude?: number;
    bannerImage?: string;
    theme?: string;
    balance?: number;
    totalSales?: number;
    instagramLink?: string;
    tiktokLink?: string;
    facebookLink?: string;
}

export interface AdminProfile extends BaseUser {
    // Admin has minimal profile data
}

// Union type for all profile types
export type UserProfile = BuyerProfile | SellerProfile | AdminProfile;

// Global user type with role discrimination
export interface GlobalUser {
    role: UserRole;
    profile: UserProfile;
    isAuthenticated: boolean;
}

// Registration data types for each role
export interface BuyerRegistrationData {
    fullName: string;
    email: string;
    mobilePayment: string;
    whatsappNumber: string;
    password: string;
    confirmPassword: string;
    city: string;
    location: string;
}

export interface SellerRegistrationData {
    fullName: string;
    shopName: string;
    email: string;
    whatsappNumber: string;
    password: string;
    confirmPassword: string;
    city?: string;
    location?: string;
    referralCode?: string;
}

export type RegistrationData =
    | BuyerRegistrationData
    | SellerRegistrationData;

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface GlobalAuthContextType {
    user: GlobalUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    role: UserRole | null;

    // Auth operations
    login: (email: string, password: string, role: UserRole) => Promise<void>;
    loginWithToken: (token: string, role: UserRole) => Promise<void>;
    loginAdmin: (email: string, password: string) => Promise<void>;
    register: (data: RegistrationData, role: UserRole) => Promise<void>;
    logout: () => void;
    refreshRole: (newRole: UserRole) => Promise<void>;

    // Password management
    forgotPassword: (email: string, role: UserRole) => Promise<boolean>;
    resetPassword: (token: string, newPassword: string, role: UserRole) => Promise<void>;

    // Profile management
    getProfile: (role: UserRole) => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>, role: UserRole) => Promise<void>;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const GlobalAuthContext = createContext<GlobalAuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function GlobalAuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<GlobalUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();
    const location = useLocation();

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /**
     * Get the appropriate API module for a given role
     */
    const getApiForRole = (role: UserRole): any => {
        switch (role) {
            case 'buyer':
                return buyerApi;
            case 'seller':
                return sellerApi;
            case 'admin':
                return adminApi;
            default:
                throw new Error(`Unknown role: ${role}`);
        }
    };

    /**
     * Get the login redirect path for a role
     */
    const getLoginPath = (role: UserRole): string => {
        return `/${role}/login`;
    };

    /**
     * Get the dashboard path for a role
     */
    const getDashboardPath = (role: UserRole): string => {
        return `/${role}/dashboard`;
    };

    /**
     * Check if current route matches a specific role
     */
    const isRoleRoute = (role: UserRole): boolean => {
        return location.pathname.startsWith(`/${role}`);
    };

    /**
     * Determine which role to check auth for based on current route
     */
    const getRoleFromRoute = (pathname: string): UserRole | null => {
        if (pathname.startsWith('/buyer')) return 'buyer';
        if (pathname.startsWith('/seller')) return 'seller';
        if (pathname.startsWith('/admin')) return 'admin';
        return null;
    };

    /**
     * Check if the current path is a public route that doesn't require authentication
     */
    const isPublicRoute = (pathname: string): boolean => {
        if (!pathname || pathname === '/') return true;

        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/marketing'];
        return publicPaths.some(path => pathname.includes(path));
    };

    // Using a ref to track currently running checkAuth to prevent race conditions
    const authCheckInProgress = useRef(false);
    // Using a ref to ensure we only run the initial auth check once
    const initialized = useRef(false);

    const checkAuth = useCallback(async (force = false) => {
        // If already checking, don't start another one unless forced
        if (authCheckInProgress.current && !force) return;

        const currentPath = globalThis.location.pathname;
        const currentRole = getRoleFromRoute(currentPath);

        // Optimization: if already authenticated for this role, skip check unless forced
        if (!force && user && user.role === currentRole && user.isAuthenticated) {
            setIsLoading(false);
            return;
        }

        // Skip auth check if we're on a public route or homepage
        if (!currentRole || isPublicRoute(currentPath)) {
            setIsLoading(false);
            return;
        }

        authCheckInProgress.current = true;
        setIsLoading(true);

        // CRITICAL: Set rehydration state to prevent 401 interceptor from redirecting
        authStateManager.setRehydrating(true);

        // Persisted State Check: Check if session was active before reload
        const sessionKey = `${currentRole}SessionActive`;

        try {
            const api = getApiForRole(currentRole);
            let profileData;

            if (currentRole === 'admin') {
                // Admin uses different auth check
                const isAuth = adminApi.isAuthenticated();
                if (!isAuth) {
                    setUser(null);
                    localStorage.removeItem(sessionKey);
                    return;
                }
                // Fetch actual admin profile
                profileData = await adminApi.getMe();
                if (!profileData) {
                    setUser(null);
                    localStorage.removeItem(sessionKey);
                    return;
                }
            } else {
                profileData = await api.getProfile();
            }

            setUser({
                role: currentRole as any,
                profile: profileData,
                isAuthenticated: true
            });

            // Mark session as active
            localStorage.setItem(sessionKey, 'true');
        } catch (error: any) {
            // CROSS-ROLE FIX: Don't fail if we're trying buyer access and user has seller session
            // This prevents the "Split Identity" 404 from blocking access
            if (currentRole === 'buyer' && (error.response?.status === 404 || error.response?.status === 401)) {
                // Keep existing user if it's just a mismatched role check (if we had one)
            } else {
                setUser(null);
                localStorage.removeItem(sessionKey);
            }
        } finally {
            // CRITICAL: Always set isLoading to false and clear rehydration state
            authStateManager.setRehydrating(false);
            setIsLoading(false);
            authCheckInProgress.current = false;
        }
    }, [user]); // Add user to deps to allow the optimization check

    useEffect(() => {
        if (!initialized.current) {
            checkAuth();
            initialized.current = true;
        }
    }, [checkAuth]);

    // ============================================================================
    // LOGIN
    // ============================================================================

    const login = useCallback(async (email: string, password: string, role: UserRole) => {
        setIsLoading(true);
        try {
            const api = getApiForRole(role);
            let profileData;

            const response = await api.login({ email, password });
            profileData = role === 'buyer' ? response.buyer : response.seller;

            setUser({
                role,
                profile: profileData,
                isAuthenticated: true
            });

            // Mark session as active
            localStorage.setItem(`${role}SessionActive`, 'true');

            toast.success('Welcome back!', {
                description: 'You have successfully logged in.',
                duration: 2000,
            });

            // Check for saved redirect location
            const redirectPath = sessionStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
                sessionStorage.removeItem('redirectAfterLogin');
                navigate(redirectPath, { replace: true });
            } else {
                // Navigate to dashboard
                navigate(getDashboardPath(role), { replace: true });
            }
        } catch (error: any) {

            const message = error.response?.data?.message || error.message || 'Login failed';
            toast.error('Login Failed', { description: message });

            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // ============================================================================
    // LOGIN WITH TOKEN (AUTO-LOGIN)
    // ============================================================================

    const loginWithToken = useCallback(async (token: string, role: UserRole) => {
        setIsLoading(true);
        try {
            // Token was sent via cookie by the server during auto-login flow.
            // Do NOT store in localStorage. Fetch profile to confirm auth.
            const api = getApiForRole(role);
            const profileData = await api.getProfile();

            setUser({
                role,
                profile: profileData,
                isAuthenticated: true
            });

            localStorage.setItem(`${role}SessionActive`, 'true');
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ============================================================================
    // ADMIN LOGIN (EMAIL/PASSWORD)
    // ============================================================================

    const loginAdmin = useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        try {
            // Using the object signature matching adminApi.ts update
            const response = await adminApi.login({ email, password });
            const success = response?.status === 'success' || !!response?.data?.token;

            if (success) {
                const adminId = response?.data?.user?.id || response?.data?.id || response?.data?.admin?.id || 1;
                setUser({
                    role: 'admin',
                    profile: {
                        id: adminId,
                        email: email,
                        createdAt: new Date().toISOString()
                    },
                    isAuthenticated: true
                });

                // Mark session as active
                localStorage.setItem('adminSessionActive', 'true');

                toast.success('Welcome Admin', {
                    description: 'You have successfully logged in.',
                    duration: 2000,
                });

                navigate('/admin/dashboard', { replace: true });
            } else {
                throw new Error('Invalid credentials');
            }
        } catch (error: any) {

            const message = error.response?.data?.message || 'Invalid email or password. Please try again.';
            toast.error('Login Failed', { description: message });

            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // ============================================================================
    // REGISTER
    // ============================================================================

    const register = useCallback(async (data: RegistrationData, role: UserRole) => {
        setIsLoading(true);
        try {
            const api = getApiForRole(role);
            let profileData;

            if (role === 'buyer') {
                const response = await api.register(data as BuyerRegistrationData);
                profileData = response.buyer;
            } else if (role === 'seller') {
                const response = await api.register(data as SellerRegistrationData);
                profileData = response.seller;
            }

            setUser({
                role,
                profile: profileData!,
                isAuthenticated: true
            });

            // Mark session as active
            localStorage.setItem(`${role}SessionActive`, 'true');

            toast.success('Account created!', {
                description: 'Your account has been successfully created.',
                duration: 3000,
            });

            navigate(getDashboardPath(role), { replace: true });
        } catch (error: any) {

            const message = error.response?.data?.message || error.message || 'Registration failed';
            toast.error('Registration Failed', { description: message });

            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // ============================================================================
    // LOGOUT
    // ============================================================================

    const logout = useCallback(async () => {
        ['buyer', 'seller', 'admin'].forEach(r => {
            localStorage.removeItem(`${r}SessionActive`);
            localStorage.removeItem(`${r}Token`);
        });

        if (!user) {
            try { clearAllAuthData(); } catch { /* ignore */ }
            return;
        }

        const role = user.role;

        try {
            const logoutUrl = role === 'seller' ? '/sellers/logout' : '/buyers/logout';
            await apiClient.post(logoutUrl);
        } catch (error) {
            // Fail silently
        } finally {
            try {
                clearAllAuthData();
            } catch (error) {
                // Fail silently — always clear user state
            }
            setUser(null);
            toast('Logged out', { description: 'You have been successfully logged out.' });
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    // ============================================================================
    // REFRESH ROLE (CROSS-ROLE SWITCHING)
    // ============================================================================

    const refreshRole = useCallback(async (newRole: UserRole) => {
        setIsLoading(true);
        try {

            // Fetch profile for the new role
            const api = getApiForRole(newRole);
            let profileData;

            if (newRole === 'admin') {
                profileData = { id: 1, email: 'admin@byblos.com', createdAt: new Date().toISOString() };
            } else {
                profileData = await api.getProfile();
            }

            // Update user state with new role and profile
            setUser({
                role: newRole,
                profile: profileData,
                isAuthenticated: true
            });

            // Mark new role session as active
            localStorage.setItem(`${newRole}SessionActive`, 'true');


            toast.success('Role Switched', {
                description: `Switched to ${newRole} dashboard`,
                duration: 2000,
            });
        } catch (error: any) {

            const message = error.response?.data?.message || 'Failed to switch role';
            toast.error('Role Switch Failed', { description: message });

            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ============================================================================
    // FORGOT PASSWORD
    // ============================================================================

    const forgotPassword = useCallback(async (email: string, role: UserRole): Promise<boolean> => {
        try {
            const api = getApiForRole(role);
            await api.forgotPassword(email);

            toast.success('Check your email', {
                description: 'If an account exists with this email, you will receive a password reset link.',
                duration: 5000,
            });

            return true;
        } catch (error: any) {

            const message = error.response?.data?.message || 'Failed to send reset email';
            toast.error('Request Failed', { description: message });

            return false;
        }
    }, []);

    // ============================================================================
    // RESET PASSWORD
    // ============================================================================

    const resetPassword = useCallback(async (token: string, newPassword: string, role: UserRole) => {
        try {
            const api = getApiForRole(role);
            await api.resetPassword(token, newPassword);

            toast.success('Password updated', {
                description: 'You can now log in with your new password.',
                duration: 3000,
            });

            navigate(getLoginPath(role), { replace: true });
        } catch (error: any) {

            const message = error.response?.data?.message || 'Failed to reset password';
            toast.error('Reset Failed', { description: message });

            throw error;
        }
    }, [navigate]);

    // ============================================================================
    // GET PROFILE
    // ============================================================================

    const getProfile = useCallback(async (role: UserRole) => {
        try {
            const api = getApiForRole(role);
            let profileData;

            if (role === 'admin') {
                const isAuth = adminApi.isAuthenticated();
                if (!isAuth) throw new Error('Not authenticated');
                profileData = await adminApi.getMe();
                if (!profileData) throw new Error('Failed to fetch admin profile');
            } else {
                profileData = await api.getProfile();
            }

            setUser({
                role,
                profile: profileData,
                isAuthenticated: true
            });
        } catch (error: any) {
            throw error;
        }
    }, []);

    // ============================================================================
    // UPDATE PROFILE
    // ============================================================================

    const updateProfile = useCallback(async (updates: Partial<UserProfile>, role: UserRole) => {
        try {
            const api = getApiForRole(role);

            // Not all APIs have updateProfile, handle accordingly
            if (api.updateProfile) {
                await api.updateProfile(updates);
            }

            // Refresh profile after update
            await getProfile(role);

            toast.success('Profile updated', {
                description: 'Your profile has been successfully updated.',
                duration: 2000,
            });
        } catch (error: any) {

            const message = error.response?.data?.message || 'Failed to update profile';
            toast.error('Update Failed', { description: message });

            throw error;
        }
    }, [getProfile]);

    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const value: GlobalAuthContextType = useMemo(() => ({
        user,
        isAuthenticated: user?.isAuthenticated || false,
        isLoading,
        role: user?.role || null,
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        refreshRole,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    }), [user, isLoading, login, loginWithToken, loginAdmin, register, logout, refreshRole, forgotPassword, resetPassword, getProfile, updateProfile]);

    return (
        <GlobalAuthContext.Provider value={value}>
            {children}
        </GlobalAuthContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export const useGlobalAuth = (): GlobalAuthContextType => {
    const context = useContext(GlobalAuthContext);
    if (context === undefined) {
        throw new Error('useGlobalAuth must be used within a GlobalAuthProvider');
    }
    return context;
};

// ============================================================================
// ROLE-SPECIFIC HOOKS (for backward compatibility)
// ============================================================================

export const useBuyerAuth = () => {
    const { user, isAuthenticated, isLoading, login, register, logout, forgotPassword, resetPassword, updateProfile } = useGlobalAuth();

    return {
        user: user?.role === 'buyer' ? user.profile as BuyerProfile : null,
        isAuthenticated: isAuthenticated && user?.role === 'buyer',
        isLoading,
        login: (email: string, password: string) => login(email, password, 'buyer'),
        register: (data: BuyerRegistrationData) => register(data, 'buyer'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'buyer'),
        resetPassword: (token: string, newPassword: string) => resetPassword(token, newPassword, 'buyer'),
        updateBuyerProfile: (updates: Partial<BuyerProfile>) => updateProfile(updates, 'buyer'),
    };
};

export const useSellerAuth = () => {
    const { user, isAuthenticated, isLoading, login, register, logout, forgotPassword, resetPassword, updateProfile } = useGlobalAuth();

    return {
        seller: user?.role === 'seller' ? user.profile as SellerProfile : null,
        isAuthenticated: isAuthenticated && user?.role === 'seller',
        isLoading,
        login: (credentials: { email: string; password: string }) => login(credentials.email, credentials.password, 'seller'),
        register: (data: SellerRegistrationData) => register(data, 'seller'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'seller'),
        resetPassword: (token: string, newPassword: string) => resetPassword(token, newPassword, 'seller'),
        updateSellerProfile: (updates: Partial<SellerProfile>) => updateProfile(updates, 'seller'),
    };
};

export const useAdminAuth = () => {
    const { user, isAuthenticated, isLoading, loginAdmin, logout } = useGlobalAuth();

    return {
        isAuthenticated: isAuthenticated && user?.role === 'admin',
        loading: isLoading,
        error: null,
        login: loginAdmin,
        logout,
    };
};
