/**
 * authContextObjects.ts
 *
 * Pure TypeScript — no JSX. Exports only context objects (createContext calls).
 * Kept in a .ts file so react-refresh/only-export-components is satisfied:
 * the corresponding .tsx provider files contain only React components.
 *
 * NOTE: Context types are defined inline here to avoid circular imports.
 */
import { createContext } from 'react';
import type { GlobalAuthContextType } from '../types/authTypes';

// ── GlobalAuth ─────────────────────────────────────────────────────────────
export const GlobalAuthContext = createContext<GlobalAuthContextType | undefined>(undefined);

// ── AdminAuth ──────────────────────────────────────────────────────────────
export interface AdminAuthContextType {
    isAuthenticated: boolean;
    loading: boolean;
    error: null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}
export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// ── BuyerAuth ──────────────────────────────────────────────────────────────
import type { BuyerProfile, BuyerRegistrationData } from '../types/authTypes';

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
export const BuyerAuthContext = createContext<BuyerAuthContextType | undefined>(undefined);

// ── SellerAuth ─────────────────────────────────────────────────────────────
import type { SellerProfile, SellerRegistrationData } from '../types/authTypes';

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
export const SellerAuthContext = createContext<SellerAuthContextType | undefined>(undefined);


