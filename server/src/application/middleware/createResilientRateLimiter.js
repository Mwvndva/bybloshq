import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../shared/config/redis.js';
import logger from '../../shared/utils/logger.js';
import { reportAlert } from '../../shared/utils/alerting.js';

/**
 * Builds a rate limiter backed by a single Redis-shared counter whenever
 * Redis is ready, and fails open to an in-memory store -- scoped to THIS
 * process only -- whenever it isn't.
 *
 * Why this exists: before this, every rate limiter in the app was either
 * (a) hand-rolled with this same Redis/fallback dance, duplicated per limiter
 * (the old authLimiter/globalLimiter), or (b) never wired to Redis at all
 * (every limiter that used to live directly in rateLimiting.js: payment,
 * withdrawal, public API, tracking, upload) -- so those five ALWAYS used a
 * per-process in-memory counter, unconditionally, regardless of Redis's
 * availability. On today's single-instance deployment that's
 * indistinguishable from correct behavior (one process's memory IS the
 * global count) -- but the moment this API ever runs more than one instance,
 * each instance enforces its own independent quota, silently multiplying the
 * *effective* limit by however many instances are running ("5 withdrawal
 * requests per hour" becomes "5 per hour, per instance"), with nothing
 * anywhere surfacing that this happened.
 *
 * Reports via reportAlert (which has its own 60s dedupe window, so this is
 * safe to call from a hot per-request path without spamming) whenever a
 * request is actually served from the in-memory fallback, so a persistent
 * Redis outage -- or simply Redis not being ready yet at boot -- is visible
 * operationally instead of silent.
 *
 * @param {string} name - short label used in Redis key prefixes, logs, and alerts (e.g. "payment", "withdrawal")
 * @param {import('express-rate-limit').Options} options - forwarded to `rateLimit()` for both the memory and Redis-backed stores (windowMs, max, keyGenerator, handler, message, etc.)
 * @param {object} [deps] - dependency overrides, for tests only; production call sites never pass this.
 * @param {() => unknown} [deps.getClient] - defaults to the real Redis singleton
 * @param {(alert: object) => unknown} [deps.alert] - defaults to the real reportAlert
 * @returns {import('express').RequestHandler}
 */
export function createResilientRateLimiter(name, options, { getClient = getRedisClient, alert = reportAlert } = {}) {
    // Always-available in-memory limiter -- the fail-open target, and (today)
    // what every one of these limiters unconditionally was.
    const memoryLimiter = rateLimit({ ...options });

    // Built once Redis is actually ready -- immediately if it already is by
    // the time this factory runs (app initialization, since every caller of
    // this factory is a module-level `export const x = createResilientRateLimiter(...)`
    // evaluated at import time), otherwise via the client's own 'ready' event,
    // which fires independently of any HTTP request. Mirrors the fix already
    // applied to the auth limiter for the same reason: express-rate-limit
    // expects a limiter to be constructed at app initialization, not while
    // responding to a request.
    let redisLimiter = null;
    function buildRedisLimiter() {
        if (redisLimiter) return;
        try {
            redisLimiter = rateLimit({
                ...options,
                store: new RedisStore({
                    prefix: `rl:${name}:`,
                    sendCommand: (...args) => getClient().call(...args),
                }),
            });
            logger.info(`[RATE-LIMIT] ${name}: Redis-backed limiter initialized`);
        } catch (err) {
            logger.warn(`[RATE-LIMIT] ${name}: failed to build Redis-backed limiter, staying on in-memory store:`, err?.message);
            redisLimiter = null;
        }
    }

    const initialClient = getClient();
    if (initialClient) {
        if (initialClient.status === 'ready') {
            buildRedisLimiter();
        } else {
            initialClient.once('ready', buildRedisLimiter);
        }
    }

    function reportFallback(reason) {
        alert({
            level: 'warn',
            title: 'Rate limiter running on in-memory fallback',
            message: `"${name}" rate limiter is not backed by Redis (${reason}) -- its count is per-instance only. Harmless on a single instance; silently multiplies the effective limit by instance count on any deployment with more than one.`,
            context: { limiter: name, reason },
        });
    }

    return (req, res, next) => {
        const client = getClient();
        const redisReady = Boolean(client) && client.status === 'ready';

        if (!redisReady) {
            reportFallback('redis not ready');
            return memoryLimiter(req, res, next);
        }

        if (!redisLimiter) {
            reportFallback('redis-backed limiter not yet built');
            return memoryLimiter(req, res, next);
        }

        return redisLimiter(req, res, (err) => {
            if (err) {
                logger.warn(`[RATE-LIMIT] ${name}: Redis limiter failed, failing open to in-memory store:`, err?.message);
                reportFallback('redis command failed mid-request');
                return memoryLimiter(req, res, next);
            }
            return next();
        });
    };
}

export default createResilientRateLimiter;
