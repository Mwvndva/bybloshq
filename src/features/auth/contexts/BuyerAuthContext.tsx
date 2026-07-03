import { createContext, ReactNode, useContext, useMemo } from 'react';
import {
    BuyerProfile,
    BuyerRegistrationData,
    useGlobalAuth,
} from './AuthCoreContext';

export interface BuyerAuthContextType {
    user: BuyerProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: BuyerRegistrationData) => Promise<{ status: string; message?: string } | void>;
    logout: () => void;
    forgotPassword: (email: string) => Promise<boolean>;
    resetPassword: (token: string, newPassword: string, email: string) => Promise<void>;
    loginWithToken: (token: string) => Promise<void>;
    updateBuyerProfile: (updates: Partial<BuyerProfile>) => Promise<void>;
}

const BuyerAuthContext = createContext<BuyerAuthContextType | undefined>(undefined);

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

    const value: BuyerAuthContextType = useMemo(() => ({
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

export const useBuyerAuth = () => {
    const context = useContext(BuyerAuthContext);
    if (context === undefined) {
        throw new Error('useBuyerAuth must be used within a BuyerAuthProvider');
    }
    return context;
};
