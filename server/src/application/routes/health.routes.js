import express from 'express';
import { pool } from '../../infrastructure/database/database.js';
import getRedisClient from '../../shared/config/redis.js';

const router = express.Router();

const REDIS_PING_TIMEOUT_MS = 1000;

/**
 * Pings Redis with a short timeout. Returns a status string rather than
 * throwing: Redis is an intentionally-optional dependency (the app fails open
 * to an in-memory rate-limit store when it is unreachable — see
 * shared/config/redis.js), so a readiness probe should REPORT Redis health for
 * visibility (e.g. to catch a misconfigured staging box) without pulling a
 * still-serviceable instance out of the load-balancer rotation.
 */
async function checkRedis() {
  try {
    const client = getRedisClient();
    if (!client || typeof client.ping !== 'function') {
      // In-memory fallback client (ioredis unavailable) — nothing to ping; it
      // is always "up" in-process.
      return 'in_memory_fallback';
    }
    const pong = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('redis ping timeout')), REDIS_PING_TIMEOUT_MS))
    ]);
    return pong === 'PONG' ? 'connected' : 'degraded';
  } catch {
    return 'disconnected';
  }
}

/**
 * @route GET /health
 * @description Health check endpoint for monitoring services
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service Unavailable',
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * @route GET /health/ready
 * @description Readiness probe endpoint for cloud load balancers and orchestrators
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    // Postgres is the hard gate — the app cannot serve requests without it.
    await pool.query('SELECT 1');
    // Redis is reported but non-fatal (see checkRedis): its status makes a
    // misconfiguration visible without failing readiness for a degraded-but-
    // serviceable instance.
    const redis = await checkRedis();
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'ready',
      redis,
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      message: 'Required dependency unavailable',
      database: 'disconnected',
      redis: await checkRedis(),
    });
  }
});

export default router;

