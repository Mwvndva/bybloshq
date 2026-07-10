import { useContext } from 'react';
import { SellerAuthContext, SellerAuthContextType } from '../contexts/SellerAuthContext';

export const useSellerAuth = (): SellerAuthContextType => {
    const context = useContext(SellerAuthContext);
    if (context === undefined) {
        throw new Error('useSellerAuth must be used within a SellerAuthProvider');
    }
    return context;
};


