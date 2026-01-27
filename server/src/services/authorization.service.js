import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class AuthorizationService {
    /**
     * Get all permissions for a user
     * @param {number} userId 
     * @returns {Promise<Set<string>>}
     */
    static async getUserPermissions(userId) {
        try {
            const sql = `
                SELECT DISTINCT p.slug
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1
            `;
            const result = await query(sql, [userId]);
            const perms = new Set(result.rows.map(row => row.slug));
            console.log(`[AuthorizationService] Loaded ${perms.size} permissions for userId ${userId}:`, Array.from(perms));
            return perms;
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
        if (!user || (!user.userId && !user.id)) {
            console.log(`[AuthorizationService] No user or IDs found:`, { email: user?.email, userId: user?.userId, id: user?.id });
            return false;
        }

        // Admin always has all permissions
        if (user.userType === 'admin') return true;

        // Fetch permissions if not already cached on the user object for this request
        if (!user.permissions) {
            const userId = user.userId || user.id;
            console.log(`[AuthorizationService] Permissions NOT cached for ${user.email}, loading for userId ${userId}`);
            user.permissions = await this.getUserPermissions(userId);
        }

        const basicResult = user.permissions.has(permission) || user.permissions.has('manage-all');

        // --- Fallback for standard roles if RBAC system fails to provide permissions ---
        if (!basicResult) {
            const sellerPerms = ['manage-shop', 'manage-products', 'manage-profile', 'request-payouts', 'view-orders'];
            if (user.userType === 'seller' && sellerPerms.includes(permission)) {
                console.log(`[AuthorizationService] RBAC failed for ${user.email}, but granted '${permission}' via seller-role fallback`);
                return true;
            }

            const organizerPerms = ['create-events', 'verify-tickets', 'view-analytics', 'manage-profile'];
            if (user.userType === 'organizer' && organizerPerms.includes(permission)) {
                return true;
            }

            const buyerPerms = ['view-orders', 'manage-profile'];
            if (user.userType === 'buyer' && buyerPerms.includes(permission)) {
                return true;
            }
        }

        console.log(`[AuthorizationService] User ${user.email} (type: ${user.userType}) check for '${permission}': ${basicResult}`);
        if (!basicResult) {
            console.log(`[AuthorizationService] Available permissions:`, Array.from(user.permissions));
        }
        return basicResult;
    }

    /**
     * Centralized check for policies
     * @param {Object} user 
     * @param {string} permission 
     * @param {Object} policy 
     * @param {string} action 
     * @param {Array} args 
     * @returns {Promise<boolean>}
     */
    static async can(user, permission, policy, action, ...args) {
        // 1. Check basic permission first
        const hasBasePermission = await this.hasPermission(user, permission);
        if (!hasBasePermission) return false;

        // 2. If a policy and action are provided, check those
        if (policy && action && typeof policy[action] === 'function') {
            return await policy[action](user, ...args);
        }

        return true;
    }
}

export default AuthorizationService;
