import express from 'express';
import { pool } from '../../infrastructure/database/database.js';
import getRedisClient from '../../shared/config/redis.js';
import paymentService from '../../domains/payments/payments/payment.service.js';

const router = express.Router();

const REDIS_PING_TIMEOUT_MS = 1000;
const PAYSTACK_CHECK_TIMEOUT_MS = 3000;

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
 * Checks reachability of the payment provider (Paystack) with a short
 * timeout. Reported alongside Redis rather than as a hard gate on readiness:
 * a lot of the app (browsing, dashboards, admin work unrelated to money
 * movement) still functions with Paystack down, so failing the whole
 * readiness probe over it would pull an otherwise-serviceable instance out of
 * rotation. It IS the payment/payout provider though, so this makes an
 * outage or misconfiguration (wrong/expired PAYSTACK_SECRET_KEY, network
 * egress blocked, Paystack itself down) visible immediately instead of only
 * surfacing the first time a real buyer tries to pay.
 */
async function checkPaystack() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return 'unconfigured';
  }
  try {
    const result = await Promise.race([
      paymentService.checkBalance(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('paystack check timeout')), PAYSTACK_CHECK_TIMEOUT_MS))
    ]);
    return result?.success === false ? 'degraded' : 'connected';
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
    // Redis and Paystack are reported but non-fatal (see checkRedis/
    // checkPaystack): their status makes a misconfiguration or outage
    // visible without failing readiness for an instance that's still
    // serviceable for everything that doesn't touch payments.
    const [redis, paystack] = await Promise.all([checkRedis(), checkPaystack()]);
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'ready',
      redis,
      paystack,
    });
  } catch (error) {
    const [redis, paystack] = await Promise.all([checkRedis(), checkPaystack()]);
    res.status(503).json({
      status: 'not_ready',
      message: 'Required dependency unavailable',
      database: 'disconnected',
      redis,
      paystack,
    });
  }
});

export default router;

