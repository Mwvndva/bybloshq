import apiClient from './apiClient';
import publicApiService from '@/api/publicApi';

/**
 * Robustly clears all possible authentication artifacts from the frontend environment.
 * This is used to ensure that a transition between user roles (e.g. from Seller to Buyer)
 * starts with a completely clean slate, preventing "Authorization" header leaks.
 */
export const clearAllAuthData = () => {

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
            localStorage.removeItem(key);
        }
    });

    // 2. Clear common axios instance defaults
    const axiosInstances = [
        apiClient,
        (publicApiService as any).getInstance ? (publicApiService as any).getInstance() : null
    ].filter(Boolean);

    axiosInstances.forEach((instance, index) => {
        try {
            if (instance.defaults?.headers?.common) {
                delete instance.defaults.headers.common['Authorization'];
                delete instance.defaults.headers.common['authorization'];
            }
        } catch (e) {
            console.warn(`[AuthCleanup] Failed to clear headers for instance ${index}`, e);
        }
    });

    // 3. Clear session storage just in case
    try {
        sessionStorage.clear();
    } catch (e) {
        console.error('[AuthCleanup] Could not clear sessionStorage', e);
    }

};
