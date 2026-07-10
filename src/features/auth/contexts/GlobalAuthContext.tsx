import { ReactNode } from 'react';
import { AuthCoreProvider } from './AuthCoreContext';
import { BuyerAuthProvider } from './BuyerAuthContext';
import { SellerAuthProvider } from './SellerAuthContext';
import { AdminAuthProvider } from './AdminAuthContext';



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


