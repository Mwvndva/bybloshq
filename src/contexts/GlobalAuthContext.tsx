import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import buyerApi from '@/api/buyerApi';
import { sellerApi } from '@/api/sellerApi';
import adminApi from '@/api/adminApi';
import apiClient from '@/lib/apiClient';
import { authStateManager } from '@/lib/authState';

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'buyer' | 'seller' | 'organizer' | 'admin';

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
    mobilePayment: string;
    whatsappNumber: string;
    city?: string;
    location?: string;
    refunds?: number;
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
    instagramLink?: string;
}

export interface OrganizerProfile extends BaseUser {
    full_name: string;
    whatsapp_number: string;
    is_verified?: boolean;
    last_login?: string | null;
}

export interface AdminProfile extends BaseUser {
    // Admin has minimal profile data
}

// Union type for all profile types
export type UserProfile = BuyerProfile | SellerProfile | OrganizerProfile | AdminProfile;

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
}

export interface OrganizerRegistrationData {
    full_name: string;
    email: string;
    whatsapp_number: string;
    password: string;
    passwordConfirm: string;
}

export type RegistrationData =
    | BuyerRegistrationData
    | SellerRegistrationData
    | OrganizerRegistrationData;

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
    loginAdmin: (pin: string) => Promise<void>;
    register: (data: RegistrationData, role: UserRole) => Promise<void>;
    logout: () => void;

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
    const getApiForRole = (role: UserRole) => {
        switch (role) {
            case 'buyer':
                return buyerApi;
            case 'seller':
                return sellerApi;
            case 'organizer':
                return {
                    getProfile: () => apiClient.get('/organizers/me'),
                    login: (email: string, password: string) => apiClient.post('/organizers/login', { email, password }),
                    register: (data: OrganizerRegistrationData) => apiClient.post('/organizers/register', data),
                    forgotPassword: (email: string) => apiClient.post('/organizers/forgot-password', { email }),
                    resetPassword: (token: string, password: string, passwordConfirm: string) =>
                        apiClient.post(`/organizers/reset-password/${token}`, { password, passwordConfirm }),
                    logout: () => apiClient.post('/organizers/logout')
                };
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
    const getRoleFromRoute = (): UserRole | null => {
        const path = location.pathname;
        if (path.startsWith('/buyer')) return 'buyer';
        if (path.startsWith('/seller')) return 'seller';
        if (path.startsWith('/organizer')) return 'organizer';
        if (path.startsWith('/admin')) return 'admin';
        return null;
    };

    // ============================================================================
    // AUTH CHECK ON MOUNT
    // ============================================================================

    const checkAuth = useCallback(async () => {
        const currentRole = getRoleFromRoute();

        // Skip auth check if we're on a public route or homepage
        if (!currentRole || location.pathname === '/') {
            setIsLoading(false);
            return;
        }

        // Skip auth check if we're on a login/register page
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
        const isPublicPath = publicPaths.some(path => location.pathname.includes(path));
        if (isPublicPath) {
            setIsLoading(false);
            return;
        }

        // CRITICAL: Set rehydration state to prevent 401 interceptor from redirecting
        authStateManager.setRehydrating(true);

        // Persisted State Check: Check if session was active before reload
        const sessionKey = `${currentRole}SessionActive`;
        const hadActiveSession = localStorage.getItem(sessionKey) === 'true';
        
        console.log(`[GlobalAuth] Checking auth for ${currentRole}, hadActiveSession: ${hadActiveSession}`);

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
                // For admin, we don't have a profile endpoint, so create minimal profile
                profileData = { id: 1, email: 'admin@byblos.com', createdAt: new Date().toISOString() };
            } else if (currentRole === 'organizer') {
                const response = await api.getProfile();
                profileData = response.data.data.organizer;
            } else {
                profileData = await api.getProfile();
            }

            setUser({
                role: currentRole,
                profile: profileData,
                isAuthenticated: true
            });
            
            // Mark session as active
            localStorage.setItem(sessionKey, 'true');
            console.log(`[GlobalAuth] Auth successful for ${currentRole}`);
        } catch (error: any) {
            console.log(`[GlobalAuth] Auth check failed for ${currentRole}:`, error.message);
            setUser(null);
            localStorage.removeItem(sessionKey);
        } finally {
            // CRITICAL: Always set isLoading to false and clear rehydration state
            authStateManager.setRehydrating(false);
            setIsLoading(false);
        }
    }, [location.pathname]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // ============================================================================
    // LOGIN
    // ============================================================================

    const login = useCallback(async (email: string, password: string, role: UserRole) => {
        setIsLoading(true);
        try {
            const api = getApiForRole(role);
            let profileData;

            if (role === 'organizer') {
                await api.login(email, password);
                const profileResponse = await api.getProfile();
                profileData = profileResponse.data.data.organizer;
            } else {
                const response = await api.login({ email, password });
                profileData = role === 'buyer' ? response.buyer : response.seller;
            }

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
            console.error(`[GlobalAuth] Login error for ${role}:`, error);

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
            // Set token in localStorage for API calls
            localStorage.setItem(`${role}Token`, token);

            // Fetch profile with the token
            const api = getApiForRole(role);
            let profileData;

            if (role === 'organizer') {
                const profileResponse = await api.getProfile();
                profileData = profileResponse.data.data.organizer;
            } else {
                profileData = await api.getProfile();
            }

            setUser({
                role,
                profile: profileData,
                isAuthenticated: true
            });
            
            // Mark session as active
            localStorage.setItem(`${role}SessionActive`, 'true');

            console.log(`[GlobalAuth] Auto-login successful for ${role}`);
        } catch (error: any) {
            console.error(`[GlobalAuth] Auto-login error for ${role}:`, error);
            localStorage.removeItem(`${role}Token`);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ============================================================================
    // ADMIN LOGIN (PIN-BASED)
    // ============================================================================

    const loginAdmin = useCallback(async (pin: string) => {
        setIsLoading(true);
        try {
            const response = await adminApi.login(pin);
            const success = response?.status === 'success' || !!response?.data?.token;

            if (success) {
                setUser({
                    role: 'admin',
                    profile: { id: 1, email: 'admin@byblos.com', createdAt: new Date().toISOString() },
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
                throw new Error('Invalid PIN');
            }
        } catch (error: any) {
            console.error('[GlobalAuth] Admin login error:', error);

            const message = error.response?.data?.message || 'Invalid PIN. Please try again.';
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

            if (role === 'organizer') {
                await api.register(data as OrganizerRegistrationData);
                const profileResponse = await api.getProfile();
                profileData = profileResponse.data.data.organizer;
            } else if (role === 'buyer') {
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
            console.error(`[GlobalAuth] Registration error for ${role}:`, error);

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

    const logout = useCallback(() => {
        // Clear session active flags for all roles
        ['buyer', 'seller', 'organizer', 'admin'].forEach(role => {
            localStorage.removeItem(`${role}SessionActive`);
        });
        if (!user) return;

        const role = user.role;

        // Call role-specific logout if available
        try {
            const api = getApiForRole(role);
            if (api.logout) {
                api.logout();
            }
        } catch (error) {
            console.error('[GlobalAuth] Logout API call failed:', error);
        }

        // Clear user state
        setUser(null);

        toast('Logged out', {
            description: 'You have been successfully logged out.',
            duration: 3000,
        });

        // Navigate to login page
        navigate(getLoginPath(role), { replace: true });
    }, [user, navigate]);

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
            console.error(`[GlobalAuth] Forgot password error for ${role}:`, error);

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

            if (role === 'organizer') {
                await api.resetPassword(token, newPassword, newPassword);
            } else {
                await api.resetPassword(token, newPassword);
            }

            toast.success('Password updated', {
                description: 'You can now log in with your new password.',
                duration: 3000,
            });

            navigate(getLoginPath(role), { replace: true });
        } catch (error: any) {
            console.error(`[GlobalAuth] Reset password error for ${role}:`, error);

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
                profileData = { id: 1, email: 'admin@byblos.com', createdAt: new Date().toISOString() };
            } else if (role === 'organizer') {
                const response = await api.getProfile();
                profileData = response.data.data.organizer;
            } else {
                profileData = await api.getProfile();
            }

            setUser({
                role,
                profile: profileData,
                isAuthenticated: true
            });
        } catch (error: any) {
            console.error(`[GlobalAuth] Get profile error for ${role}:`, error);
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
            console.error(`[GlobalAuth] Update profile error for ${role}:`, error);

            const message = error.response?.data?.message || 'Failed to update profile';
            toast.error('Update Failed', { description: message });

            throw error;
        }
    }, [getProfile]);

    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const value: GlobalAuthContextType = {
        user,
        isAuthenticated: user?.isAuthenticated || false,
        isLoading,
        role: user?.role || null,
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    };

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
    const { user, isAuthenticated, isLoading, login, register, logout, forgotPassword, resetPassword } = useGlobalAuth();

    return {
        user: user?.role === 'buyer' ? user.profile as BuyerProfile : null,
        isAuthenticated: isAuthenticated && user?.role === 'buyer',
        isLoading,
        login: (email: string, password: string) => login(email, password, 'buyer'),
        register: (data: BuyerRegistrationData) => register(data, 'buyer'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'buyer'),
        resetPassword: (token: string, newPassword: string) => resetPassword(token, newPassword, 'buyer'),
    };
};

export const useSellerAuth = () => {
    const { user, isAuthenticated, isLoading, login, register, logout, forgotPassword, resetPassword } = useGlobalAuth();

    return {
        seller: user?.role === 'seller' ? user.profile as SellerProfile : null,
        isAuthenticated: isAuthenticated && user?.role === 'seller',
        isLoading,
        login: (credentials: { email: string; password: string }) => login(credentials.email, credentials.password, 'seller'),
        register: (data: SellerRegistrationData) => register(data, 'seller'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'seller'),
        resetPassword: (token: string, newPassword: string) => resetPassword(token, newPassword, 'seller'),
    };
};

export const useOrganizerAuth = () => {
    const { user, isAuthenticated, isLoading, login, register, logout, forgotPassword, resetPassword, updateProfile } = useGlobalAuth();

    return {
        organizer: user?.role === 'organizer' ? user.profile as OrganizerProfile : null,
        token: isAuthenticated ? 'authenticated' : null,
        isAuthenticated: isAuthenticated && user?.role === 'organizer',
        isLoading,
        error: null,
        login: (email: string, password: string) => login(email, password, 'organizer'),
        register: (data: OrganizerRegistrationData) => register(data, 'organizer'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'organizer'),
        resetPassword: (token: string, password: string, passwordConfirm: string) => resetPassword(token, password, 'organizer'),
        updateOrganizer: (updates: Partial<OrganizerProfile>) => updateProfile(updates, 'organizer'),
        clearError: () => { },
        getToken: async () => isAuthenticated ? 'authenticated' : null,
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
