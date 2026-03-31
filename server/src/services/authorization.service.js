import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import CacheService from './cache.service.js';

class AuthorizationService {
    /**
     * Get all permissions for a user with Redis caching
     * @param {number} userId 
     * @returns {Promise<Set<string>>}
     */
    static async getUserPermissions(userId) {
        const cacheKey = `user:${userId}:permissions`;

        try {
            // 1. Try Cache
            const cachedPerms = await CacheService.get(cacheKey);
            if (cachedPerms && Array.isArray(cachedPerms)) {
                return new Set(cachedPerms);
            }

            // 2. Try DB
            const sql = `
                SELECT DISTINCT p.slug
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1
            `;
            const result = await query(sql, [userId]);
            const permsArray = result.rows.map(row => row.slug);

            // 3. Save to Cache (5 min TTL)
            await CacheService.set(cacheKey, permsArray, 300);

            return new Set(permsArray);
        } catch (error) {
            logger.error(`Error fetching permissions for user ${userId}:`, error);
            return new Set();
        }
    }

    /**
     * Check if user has a specific permission
     * @param {Object} user 
     * @param {string} permission 
     * @returns {Promise<boolean>}
     */
    static async hasPermission(user, permission) {
        if (!user || (!user.userId && !user.id)) return false;

        // Admin always has all permissions
        if (user.role === 'admin' || user.userType === 'admin') return true;

        // Fetch permissions if not already attached to user object for this request
        if (!user.permissions) {
            const userId = user.userId || user.id;
            user.permissions = await this.getUserPermissions(userId);
        }

        const basicResult = user.permissions.has(permission) || user.permissions.has('manage-all');

        // RBAC Table Fallback logic (Hardcoded maps for resilience if DB is empty)
        if (!basicResult) {
            const sellerPerms = ['manage-shop', 'manage-products', 'manage-profile', 'request-payouts', 'view-orders'];
            if ((user.userType === 'seller' || user.hasSellerProfile) && sellerPerms.includes(permission)) {
                return true;
            }

            const buyerPerms = ['view-orders', 'manage-profile'];
            if ((user.userType === 'buyer' || user.hasBuyerProfile) && buyerPerms.includes(permission)) {
                return true;
            }
        }

        return basicResult;
    }

    /**
     * Centralized check for policies (ownership, etc)
     */
    static async can(user, permission, policy, action, ...args) {
        const hasBasePermission = await this.hasPermission(user, permission);
        if (!hasBasePermission) return false;

        if (policy && action && typeof policy[action] === 'function') {
            const result = await policy[action](user, ...args);

            if (!result) {
                logger.warn(`[POLICY-DENIED] ${action}() blocked ${user.email || user.id}`, {
                    permission,
                    userId: user.id,
                    sellerId: user.sellerId,
                    profileId: user.profileId,
                });
            }

            return result;
        }
        return true;
    }

    /**
     * Invalidates the permission cache for a user.
     * Call this when roles or permissions are updated.
     */
    static async invalidateUserPermissions(userId) {
        if (!userId) return;
        await CacheService.delete(`user:${userId}:permissions`);
    }
}

export default AuthorizationService;
