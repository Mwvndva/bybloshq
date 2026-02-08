import logger from '../utils/logger.js';

/**
 * Token Blacklist Service (P1-005)
 * 
 * Implements token blacklisting for secure logout functionality.
 * When a user logs out, their JWT token is added to a blacklist
 * to prevent it from being used until it naturally expires.
 * 
 * IMPLEMENTATION NOTES:
 * - Uses in-memory Map for simplicity (suitable for single-server deployments)
 * - For multi-server deployments, use Redis instead
 * - Tokens are automatically cleaned up after expiration
 * - Cleanup runs every 15 minutes to prevent memory leaks
 */

class TokenBlacklistService {
    constructor() {
        // Map: token -> expiryTimestamp
        this.blacklist = new Map();

        // Start cleanup interval
        this.startCleanup();

        logger.info('[TOKEN-BLACKLIST] Service initialized');
    }

    /**
     * Add a token to the blacklist
     * @param {string} token - JWT token to blacklist
     * @param {number} expiresAt - Unix timestamp when token expires
     */
    addToken(token, expiresAt) {
        this.blacklist.set(token, expiresAt);
        logger.info('[TOKEN-BLACKLIST] Token added to blacklist', {
            tokenPrefix: token.substring(0, 20) + '...',
            expiresAt: new Date(expiresAt * 1000).toISOString(),
            blacklistSize: this.blacklist.size
        });
    }

    /**
     * Check if a token is blacklisted
     * @param {string} token - JWT token to check
     * @returns {boolean} True if token is blacklisted
     */
    isBlacklisted(token) {
        const expiresAt = this.blacklist.get(token);

        if (!expiresAt) {
            return false;
        }

        // Check if token has expired (cleanup might not have run yet)
        const now = Math.floor(Date.now() / 1000);
        if (now > expiresAt) {
            // Token has expired, remove from blacklist
            this.blacklist.delete(token);
            return false;
        }

        return true;
    }

    /**
     * Remove a token from the blacklist (rarely needed)
     * @param {string} token - JWT token to remove
     */
    removeToken(token) {
        const removed = this.blacklist.delete(token);
        if (removed) {
            logger.info('[TOKEN-BLACKLIST] Token removed from blacklist', {
                tokenPrefix: token.substring(0, 20) + '...'
            });
        }
        return removed;
    }

    /**
     * Clean up expired tokens from the blacklist
     * This prevents memory leaks from accumulating expired tokens
     */
    cleanup() {
        const now = Math.floor(Date.now() / 1000);
        let removedCount = 0;

        for (const [token, expiresAt] of this.blacklist.entries()) {
            if (now > expiresAt) {
                this.blacklist.delete(token);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            logger.info('[TOKEN-BLACKLIST] Cleanup completed', {
                removedCount,
                remainingCount: this.blacklist.size
            });
        }
    }

    /**
     * Start automatic cleanup interval
     * Runs every 15 minutes to remove expired tokens
     */
    startCleanup() {
        // Run cleanup every 15 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 15 * 60 * 1000);

        logger.info('[TOKEN-BLACKLIST] Automatic cleanup started (every 15 minutes)');
    }

    /**
     * Stop automatic cleanup (for graceful shutdown)
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            logger.info('[TOKEN-BLACKLIST] Automatic cleanup stopped');
        }
    }

    /**
     * Get blacklist statistics
     * @returns {object} Statistics about the blacklist
     */
    getStats() {
        const now = Math.floor(Date.now() / 1000);
        let expiredCount = 0;
        let activeCount = 0;

        for (const expiresAt of this.blacklist.values()) {
            if (now > expiresAt) {
                expiredCount++;
            } else {
                activeCount++;
            }
        }

        return {
            total: this.blacklist.size,
            active: activeCount,
            expired: expiredCount
        };
    }

    /**
     * Clear all tokens from the blacklist (use with caution!)
     */
    clear() {
        const count = this.blacklist.size;
        this.blacklist.clear();
        logger.warn('[TOKEN-BLACKLIST] All tokens cleared from blacklist', { count });
        return count;
    }
}

// Export singleton instance
export default new TokenBlacklistService();
