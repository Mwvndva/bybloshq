import { useEffect, useMemo, useState, ReactNode } from 'react';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthActions } from '../hooks/useAuthActions';
import { useAuthRevalidation } from '../hooks/useAuthRevalidation';
import { GlobalAuthContext } from './authContextObjects';
import {
    clearAppNavigator,
    registerAppNavigator,
    SESSION_EXPIRED_EVENT,
    type SessionExpiredDetail,
} from '@/infrastructure/navigation/navigationService';

export { GlobalAuthContext } from './authContextObjects';

export type {
    AdminProfile,
    BuyerProfile,
    BuyerRegistrationData,
    GlobalAuthContextType,
    GlobalUser,
    RegistrationData,
    SellerProfile,
    SellerRegistrationData,
    UserProfile,
    UserRole,
} from '../types/authTypes';

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function AuthCoreProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<import('../types/authTypes').GlobalUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Separate flag: only true during the very first page-load auth check.
    // Unlike isLoading, this does NOT become true again during login/register.
    const [initializing, setInitializing] = useState<boolean>(true);
    const navigate = useNavigate();
    const location = useLocation();

    const { markAuthChecked } = useAuthRevalidation({
        pathname: location.pathname,
        user,
        setUser,
        setIsLoading,
        setInitializing,
        navigate,
    });

    // Bridge non-React modules (axios 401 handler, native push deep-links) to the
    // client-side router so they navigate WITHOUT a full page reload. A hard
    // `location.href` reload wipes this in-memory auth state and, on native,
    // cold-reboots the WebView — which is what bounced users back to login.
    useEffect(() => {
        const navigateFn = (path: string, options?: { replace?: boolean }) =>
            navigate(path, options);
        registerAppNavigator(navigateFn);

        const handleSessionExpired = (event: Event) => {
            const detail = (event as CustomEvent<SessionExpiredDetail>).detail;
            const redirectPath = detail?.redirectPath ?? '/buyer/login';
            try {
                localStorage.removeItem('byblos_auth_checked');
                localStorage.removeItem('byblos_user_role');
            } catch { /* ignore storage errors */ }
            setUser(null);
            navigate(redirectPath, { replace: true });
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

        return () => {
            clearAppNavigator(navigateFn);
            window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        };
    }, [navigate]);

    const {
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        switchAccount,
        refreshRole,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    } = useAuthActions({
        navigate,
        user,
        setUser,
        setIsLoading,
        markAuthChecked,
    });
    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const value: import('../types/authTypes').GlobalAuthContextType = useMemo(() => ({
        user,
        isAuthenticated: user?.isAuthenticated || false,
        isLoading,
        role: user?.role || null,
        login,
        loginWithToken,
        loginAdmin,
        register,
        logout,
        switchAccount,
        refreshRole,
        forgotPassword,
        resetPassword,
        getProfile,
        updateProfile,
    }), [user, isLoading, login, loginWithToken, loginAdmin, register, logout, switchAccount, refreshRole, forgotPassword, resetPassword, getProfile, updateProfile]);

    // ============================================================================
    // RENDER GATING (Prevents Flickering)
    // ============================================================================

    // Only gate on the FIRST page-load auth check.
    // Using `initializing` (not `isLoading`) so login/register do NOT unmount the active page.
    if (initializing) {
        return <LoadingScreen message="Loading..." />;
    }

    return (
        <GlobalAuthContext.Provider value={value}>
            {children}
        </GlobalAuthContext.Provider>
    );
}


