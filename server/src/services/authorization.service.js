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
            return new Set(result.rows.map(row => row.slug));
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
        if (user.userType === 'admin') return true;

        // Fetch permissions if not already cached on the user object for this request
        if (!user.permissions) {
            const userId = user.userId || user.id;
            user.permissions = await this.getUserPermissions(userId);
        }

        return user.permissions.has(permission) || user.permissions.has('manage-all');
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
