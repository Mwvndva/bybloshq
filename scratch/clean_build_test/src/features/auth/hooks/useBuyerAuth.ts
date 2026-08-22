import { useContext } from 'react';
import { BuyerAuthContext, BuyerAuthContextType } from '../contexts/BuyerAuthContext';

export const useBuyerAuth = (): BuyerAuthContextType => {
    const context = useContext(BuyerAuthContext);
    if (context === undefined) {
        throw new Error('useBuyerAuth must be used within a BuyerAuthProvider');
    }
    return context;
};


