import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthActions } from '../hooks/useAuthActions';
import { useAuthRevalidation } from '../hooks/useAuthRevalidation';
import type {
    GlobalAuthContextType,
    GlobalUser,
} from '../types/authTypes';

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
// CONTEXT CREATION
// ============================================================================

const GlobalAuthContext = createContext<GlobalAuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function AuthCoreProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<GlobalUser | null>(null);
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
    });

    const {
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
