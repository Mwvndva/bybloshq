import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Token Blacklist Service — Redis-backed (C-6 fix)
 *
 * Tokens are stored in Redis with TTL = remaining JWT lifetime so they
 * expire automatically. Falls back to an in-memory Map when Redis is
 * unavailable (graceful degradation with a warning).
 *
 * Redis key format: bl:<token>  value: '1'
 */

class TokenBlacklistService {
    constructor() {
        // In-memory fallback — used when Redis is unavailable
        this._memBlacklist = new Map();
        this._redisAvailable = false;

        // Attempt to get the Redis client created by config/redis.js
        try {
            this.redis = getRedisClient();
            this.redis.on('ready', () => {
                this._redisAvailable = true;
                logger.info('[TOKEN-BLACKLIST] Redis connection ready — using Redis persistence');
            });
            this.redis.on('error', () => {
                if (this._redisAvailable) {
                    logger.warn('[TOKEN-BLACKLIST] Redis connection lost — falling back to in-memory blacklist');
                }
                this._redisAvailable = false;
            });
            this.redis.on('connect', () => {
                this._redisAvailable = true;
            });
        } catch (e) {
            logger.warn('[TOKEN-BLACKLIST] Could not obtain Redis client — using in-memory fallback:', e.message);
            this.redis = null;
        }

        // Cleanup interval for the in-memory fallback
        this.cleanupInterval = setInterval(() => this._cleanupMemory(), 15 * 60 * 1000);
        logger.info('[TOKEN-BLACKLIST] Service initialized (Redis + in-memory fallback)');
    }

    /**
     * Add a token to the blacklist.
     * @param {string} token - JWT token to blacklist
     * @param {number} expiresAt - Unix timestamp when the token expires
     */
    async addToken(token, expiresAt) {
        const ttl = expiresAt - Math.floor(Date.now() / 1000);
        if (ttl <= 0) return; // Token already expired — nothing to do

        const redisKey = `bl:${token}`;

        if (this.redis && this._redisAvailable) {
            try {
                await this.redis.setex(redisKey, ttl, '1');
                logger.info('[TOKEN-BLACKLIST] Token blacklisted in Redis', {
                    tokenPrefix: token.substring(0, 20) + '...',
                    ttlSeconds: ttl
                });
                return;
            } catch (err) {
                logger.warn('[TOKEN-BLACKLIST] Redis setex failed — falling back to memory:', err.message);
            }
        }

        // In-memory fallback
        this._memBlacklist.set(token, expiresAt);
        logger.warn('[TOKEN-BLACKLIST] Token blacklisted in memory (Redis unavailable)', {
            tokenPrefix: token.substring(0, 20) + '...'
        });
    }

    /**
     * Check if a token is blacklisted.
     * @param {string} token - JWT token to check
     * @returns {Promise<boolean>}
     */
    async isBlacklisted(token) {
        const redisKey = `bl:${token}`;

        if (this.redis && this._redisAvailable) {
            try {
                const result = await this.redis.get(redisKey);
                return result === '1';
            } catch (err) {
                logger.warn('[TOKEN-BLACKLIST] Redis get failed — checking in-memory:', err.message);
            }
        }

        // In-memory fallback
        const expiresAt = this._memBlacklist.get(token);
        if (!expiresAt) return false;
        const now = Math.floor(Date.now() / 1000);
        if (now > expiresAt) {
            this._memBlacklist.delete(token);
            return false;
        }
        return true;
    }

    /**
     * Remove a token from the blacklist (rarely needed).
     */
    async removeToken(token) {
        const redisKey = `bl:${token}`;
        if (this.redis && this._redisAvailable) {
            try {
                await this.redis.del(redisKey);
            } catch (err) {
                logger.warn('[TOKEN-BLACKLIST] Redis del failed:', err.message);
            }
        }
        this._memBlacklist.delete(token);
    }

    /** Clean up expired entries from the in-memory fallback */
    _cleanupMemory() {
        const now = Math.floor(Date.now() / 1000);
        let removed = 0;
        for (const [token, expiresAt] of this._memBlacklist.entries()) {
            if (now > expiresAt) {
                this._memBlacklist.delete(token);
                removed++;
            }
        }
        if (removed > 0) {
            logger.info('[TOKEN-BLACKLIST] In-memory cleanup', { removed, remaining: this._memBlacklist.size });
        }
    }

    stopCleanup() {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    getStats() {
        return {
            redisAvailable: this._redisAvailable,
            memoryFallbackSize: this._memBlacklist.size
        };
    }
}

// Export singleton instance
export default new TokenBlacklistService();
