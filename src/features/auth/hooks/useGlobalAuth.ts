import { useContext } from 'react';
import { GlobalAuthContext } from '../contexts/AuthCoreContext';
import { GlobalAuthContextType } from '../types/authTypes';

export const useGlobalAuth = (): GlobalAuthContextType => {
    const context = useContext(GlobalAuthContext);
    if (context === undefined) {
        throw new Error('useGlobalAuth must be used within a GlobalAuthProvider');
    }
    return context;
};


