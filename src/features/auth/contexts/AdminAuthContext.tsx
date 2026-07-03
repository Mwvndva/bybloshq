import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useGlobalAuth } from './AuthCoreContext';

export interface AdminAuthContextType {
    isAuthenticated: boolean;
    loading: boolean;
    error: null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
    const {
        user,
        isLoading,
        loginAdmin,
        logout,
    } = useGlobalAuth();

    const adminAuthenticated = Boolean(user?.isAuthenticated && user.role === 'admin');

    const value: AdminAuthContextType = useMemo(() => ({
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

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (context === undefined) {
        throw new Error('useAdminAuth must be used within an AdminAuthProvider');
    }
    return context;
};
