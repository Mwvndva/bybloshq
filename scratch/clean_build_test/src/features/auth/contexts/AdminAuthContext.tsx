import { ReactNode, useMemo } from 'react';
import { useGlobalAuth } from '../hooks/useGlobalAuth';
import { AdminAuthContext } from './authContextObjects';

export { AdminAuthContext } from './authContextObjects';
export type { AdminAuthContextType } from './authContextObjects';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const {
        user,
        isLoading,
        loginAdmin,
        logout,
    } = useGlobalAuth();

    const adminAuthenticated = Boolean(user?.isAuthenticated && user.role === 'admin');

    const value: import('./authContextObjects').AdminAuthContextType = useMemo(() => ({
        isAuthenticated: adminAuthenticated,
        loading: isLoading,
        error: null,
        login: loginAdmin,
        logout,
    }), [adminAuthenticated, isLoading, loginAdmin, logout]);

    return (
        <AdminAuthContext.Provider value={value}>
            {children}
        </AdminAuthContext.Provider>
    );
}


