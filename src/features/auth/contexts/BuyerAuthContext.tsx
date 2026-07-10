import { ReactNode, useMemo } from 'react';
import type { BuyerProfile, BuyerRegistrationData } from '../types/authTypes';
import { useGlobalAuth } from '../hooks/useGlobalAuth';
import { BuyerAuthContext } from './authContextObjects';

export { BuyerAuthContext } from './authContextObjects';
export type { BuyerAuthContextType } from './authContextObjects';

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
    const {
        user,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        loginWithToken,
        updateProfile,
    } = useGlobalAuth();

    const buyerProfile = user?.role === 'buyer' ? user.profile as BuyerProfile : null;
    const buyerAuthenticated = Boolean(user?.isAuthenticated && user.role === 'buyer');

    const value: import('./authContextObjects').BuyerAuthContextType = useMemo(() => ({
        user: buyerProfile,
        isAuthenticated: buyerAuthenticated,
        isLoading,
        login: (email: string, password: string) => login(email, password, 'buyer'),
        register: (data: BuyerRegistrationData) => register(data, 'buyer'),
        logout,
        forgotPassword: (email: string) => forgotPassword(email, 'buyer'),
        resetPassword: (token: string, newPassword: string, email: string) => resetPassword(token, newPassword, email, 'buyer'),
        loginWithToken: (token: string) => loginWithToken(token, 'buyer'),
        updateBuyerProfile: (updates: Partial<BuyerProfile>) => updateProfile(updates, 'buyer'),
    }), [
        buyerProfile,
        buyerAuthenticated,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        loginWithToken,
        updateProfile,
    ]);

    return (
        <BuyerAuthContext.Provider value={value}>
            {children}
        </BuyerAuthContext.Provider>
    );
}


