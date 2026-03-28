import axios from 'axios';
import apiClient from './apiClient'; // This is for generic API calls
import { publicApi } from '@/api/publicApi';

/**
 * Robustly clears all possible authentication artifacts from the frontend environment.
 * This is used to ensure that a transition between user roles (e.g. from Seller to Buyer)
 * starts with a completely clean slate, preventing "Authorization" header leaks.
 */
export const clearAllAuthData = () => {
    console.log('🧹 [AuthCleanup] Initiating comprehensive auth data wipe...');

    // 1. Clear all known localStorage keys
    const authKeys = [
        'token',
        'sellerToken',
        'buyer_token',
        'organizerToken',
        'adminToken',
        'authToken',
        'jwt',
        'user',
        'seller',
        'buyer',
        'sellerSessionActive',
        'buyerSessionActive',
        'adminSessionActive',
        'organizerSessionActive'
    ];

    authKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            console.log(`🗑️ [AuthCleanup] Removing ${key} from localStorage`);
            localStorage.removeItem(key);
        }
    });

    // 2. Clear common axios instance defaults
    const axiosInstances = [
        axios,
        apiClient,
        publicApi.getInstance()
    ].filter(Boolean);

    axiosInstances.forEach((instance, index) => {
        try {
            if (instance.defaults?.headers?.common) {
                console.log(`🔌 [AuthCleanup] Clearing Authorization header from instance ${index}`);
                delete instance.defaults.headers.common['Authorization'];
                delete instance.defaults.headers.common['authorization'];
            }
        } catch (e) {
            console.warn(`⚠️ [AuthCleanup] Failed to clear headers for instance ${index}`, e);
        }
    });

    // 3. Clear session storage just in case
    try {
        sessionStorage.clear();
    } catch (e) {
        console.error('[AuthCleanup] Could not clear sessionStorage', e);
    }

    console.log('✅ [AuthCleanup] All frontend auth pointers have been purged.');
};
