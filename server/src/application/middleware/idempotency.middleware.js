import logger from '../../shared/utils/logger.js';
import { getRedisClient } from '../../shared/config/redis.js';

export const enforceIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!idempotencyKey) return next();

  let redisClient = null;
  try {
    redisClient = getRedisClient();
  } catch (e) {
    redisClient = null;
  }

  if (redisClient) {
    try {
      const cacheKey = `idempotency:${idempotencyKey}`;
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        logger.info(`[IDEMPOTENCY] Replayed cached response for key ${idempotencyKey}`);
        const { status, body } = JSON.parse(cachedResponse);
        return res.status(status).json(body);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient.setex(cacheKey, 86400, JSON.stringify({ status: res.statusCode, body })).catch(err => {
            logger.warn('[IDEMPOTENCY] Failed to cache response in Redis:', err.message);
          });
        }
        return originalJson(body);
      };
    } catch (err) {
      logger.warn('[IDEMPOTENCY] Redis error in idempotency middleware:', err.message);
    }
  }

  next();
};

export default enforceIdempotency;
