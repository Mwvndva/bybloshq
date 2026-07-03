import { ReactNode } from 'react';
import { AuthCoreProvider } from './AuthCoreContext';
import { BuyerAuthProvider, useBuyerAuth } from './BuyerAuthContext';
import { SellerAuthProvider, useSellerAuth } from './SellerAuthContext';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';

export * from './AuthCoreContext';
export type { BuyerAuthContextType } from './BuyerAuthContext';
export type { SellerAuthContextType } from './SellerAuthContext';
export type { AdminAuthContextType } from './AdminAuthContext';
export { useBuyerAuth, useSellerAuth, useAdminAuth };

export function GlobalAuthProvider({ children }: { children: ReactNode }) {
    return (
        <AuthCoreProvider>
            <BuyerAuthProvider>
                <SellerAuthProvider>
                    <AdminAuthProvider>
                        {children}
                    </AdminAuthProvider>
                </SellerAuthProvider>
            </BuyerAuthProvider>
        </AuthCoreProvider>
    );
}
