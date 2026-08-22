import { ReactNode, useMemo } from 'react';
import type { SellerProfile, SellerRegistrationData } from '../types/authTypes';
import { useGlobalAuth } from '../hooks/useGlobalAuth';
import { SellerAuthContext } from './authContextObjects';

export { SellerAuthContext } from './authContextObjects';
export type { SellerAuthContextType } from './authContextObjects';

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

    const value: import('./authContextObjects').SellerAuthContextType = useMemo(() => ({
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


