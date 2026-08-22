import { ReactNode } from 'react';
import { AuthCoreProvider } from './AuthCoreContext';

export function GlobalAuthProvider({ children }: { children: ReactNode }) {
    return (
        <AuthCoreProvider>
            {children}
        </AuthCoreProvider>
    );
}
