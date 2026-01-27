import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

class CacheService {
    constructor() {
        this.redis = getRedisClient();
        this.defaultTTL = 300; // 5 minutes default
    }

    /**
     * Get value from cache
     * @param {string} key 
     * @returns {Promise<any>}
     */
    async get(key) {
        try {
            if (!this.redis) return null;

            const data = await this.redis.get(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            logger.error(`Cache Get Error (${key}):`, error);
            return null;
        }
    }

    /**
     * Set value in cache
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlSeconds 
     */
    async set(key, value, ttlSeconds = this.defaultTTL) {
        try {
            if (!this.redis) return false;

            const stringValue = JSON.stringify(value);
            await this.redis.set(key, stringValue, 'EX', ttlSeconds);
            return true;
        } catch (error) {
            logger.error(`Cache Set Error (${key}):`, error);
            return false;
        }
    }

    /**
     * Delete value from cache
     * @param {string} key 
     */
    async del(key) {
        try {
            if (!this.redis) return false;
            await this.redis.del(key);
            return true;
        } catch (error) {
            logger.error(`Cache Del Error (${key}):`, error);
            return false;
        }
    }

    /**
     * Clear cache with pattern
     * @param {string} pattern e.g. "products:*"
     */
    async clearPattern(pattern) {
        try {
            if (!this.redis) return false;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
            return true;
        } catch (error) {
            logger.error(`Cache Clear Pattern Error (${pattern}):`, error);
            return false;
        }
    }
}

export default new CacheService();
