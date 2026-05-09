import { createContext, ReactNode, useContext, useMemo } from 'react';
import {
    SellerProfile,
    SellerRegistrationData,
    useGlobalAuth,
} from './AuthCoreContext';

export interface SellerAuthContextType {
    seller: SellerProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: { email: string; password: string }) => Promise<void>;
    register: (data: SellerRegistrationData) => Promise<{ status: string; message?: string } | void>;
    logout: () => void;
    forgotPassword: (email: string) => Promise<boolean>;
    resetPassword: (token: string, newPassword: string, email: string) => Promise<void>;
    updateSellerProfile: (updates: Partial<SellerProfile>) => Promise<void>;
}

const SellerAuthContext = createContext<SellerAuthContextType | undefined>(undefined);

export function SellerAuthProvider({ children }: { children: ReactNode }) {
    const {
        user,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
    } = useGlobalAuth();

    const sellerProfile = user?.role === 'seller' ? user.profile as SellerProfile : null;
    const sellerAuthenticated = Boolean(user?.isAuthenticated && user.role === 'seller');

    const value: SellerAuthContextType = useMemo(() => ({
        seller: sellerProfile,
        isAuthenticated: sellerAuthenticated,
        isLoading,
        login: (credentials: { email: string; password: string }) => login(credentials.email, credentials.password, 'seller'),
        register: (data: SellerRegistrationData) => register(data, 'seller'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'seller'),
        resetPassword: (token: string, newPassword: string, email: string) => resetPassword(token, newPassword, email, 'seller'),
        updateSellerProfile: (updates: Partial<SellerProfile>) => updateProfile(updates, 'seller'),
    }), [
        sellerProfile,
        sellerAuthenticated,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
    ]);

    return (
        <SellerAuthContext.Provider value={value}>
            {children}
        </SellerAuthContext.Provider>
    );
}

export const useSellerAuth = () => {
    const context = useContext(SellerAuthContext);
    if (context === undefined) {
        throw new Error('useSellerAuth must be used within a SellerAuthProvider');
    }
    return context;
};
