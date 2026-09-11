// Unit tests for createResilientRateLimiter -- the shared Redis-backed,
// fail-open-to-memory rate limiter factory (see its own doc comment for the
// audit finding this exists to fix: several limiters were unconditionally
// in-memory-only, with no relationship to Redis's availability, harmless
// only by accident on a single-instance deployment).
//
// No real Redis is available in this environment (confirmed: connecting to
// localhost:6379 fails with ECONNREFUSED), so these tests inject a fake
// client via the factory's `deps` parameter rather than depending on a real
// one -- that parameter exists for exactly this. The fake emulates just
// enough of the Redis protocol (SCRIPT LOAD / EVALSHA) for rate-limit-redis's
// RedisStore to function; re-verifying RedisStore's own Lua-script logic is
// that package's responsibility, not this factory's -- these tests verify
// createResilientRateLimiter's own responsibility: dispatching to the right
// store based on readiness, and alerting when it falls back.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createResilientRateLimiter } from '../src/application/middleware/createResilientRateLimiter.js';

// Emulates enough of ioredis + the two Lua scripts rate-limit-redis loads
// (SCRIPT LOAD then EVALSHA with a PTTL-based sliding window) to drive a real
// RedisStore instance, backed by a plain in-process Map instead of a real
// Redis server.
function makeFakeReadyClient() {
    const counters = new Map(); // key -> { count, expiresAt }
    const scripts = new Map(); // fake sha -> 'increment' | 'get'
    let nextSha = 1;
    const calls = [];

    return {
        status: 'ready',
        _calls: calls,
        once() { /* no 'ready' listener needed -- already ready */ },
        async call(command, ...args) {
            calls.push([command, ...args]);
            const cmd = String(command).toUpperCase();
            if (cmd === 'SCRIPT' && String(args[0]).toUpperCase() === 'LOAD') {
                const scriptBody = args[1];
                const kind = scriptBody.includes('local totalHits = redis.call("GET"') ? 'get' : 'increment';
                const sha = `fakesha-${nextSha++}`;
                scripts.set(sha, kind);
                return sha;
            }
            if (cmd === 'EVALSHA') {
                const [sha, , key, , windowMsStr] = args;
                const kind = scripts.get(sha);
                if (!kind) throw new Error('NOSCRIPT');
                const now = Date.now();
                const windowMs = Number(windowMsStr) || 60000;
                const existing = counters.get(key);
                if (kind === 'get') {
                    if (!existing || existing.expiresAt <= now) return [false, 0];
                    return [existing.count, existing.expiresAt - now];
                }
                if (!existing || existing.expiresAt <= now) {
                    counters.set(key, { count: 1, expiresAt: now + windowMs });
                    return [1, windowMs];
                }
                existing.count += 1;
                return [existing.count, existing.expiresAt - now];
            }
            throw new Error(`fake redis client: unsupported command ${cmd}`);
        },
    };
}

function makeNotReadyClient() {
    return { status: 'connecting', once() {} };
}

async function withServer(middleware, fn) {
    const app = express();
    app.get('/test', middleware, (req, res) => res.status(200).json({ ok: true }));
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    try {
        await fn(`http://127.0.0.1:${port}/test`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

describe('createResilientRateLimiter', () => {
    test('Redis not ready: dispatches to the in-memory limiter and reports the fallback', async () => {
        const alerts = [];
        const limiter = createResilientRateLimiter(
            'test-not-ready',
            { windowMs: 60_000, max: 2 },
            { getClient: () => makeNotReadyClient(), alert: (a) => alerts.push(a) }
        );

        await withServer(limiter, async (url) => {
            const r1 = await fetch(url);
            const r2 = await fetch(url);
            const r3 = await fetch(url);
            assert.equal(r1.status, 200);
            assert.equal(r2.status, 200);
            assert.equal(r3.status, 429, 'in-memory limiter still enforces max=2');
        });

        assert.ok(alerts.length > 0, 'reportFallback was called at least once');
        assert.equal(alerts[0].title, 'Rate limiter running on in-memory fallback');
        assert.match(alerts[0].message, /test-not-ready/);
        assert.match(alerts[0].message, /redis not ready/);
        assert.equal(alerts[0].context.limiter, 'test-not-ready');
    });

    test('Redis ready: dispatches to the Redis-backed limiter (real EVALSHA round-trips against the fake client) and does not report a fallback', async () => {
        const alerts = [];
        const fakeClient = makeFakeReadyClient();
        const limiter = createResilientRateLimiter(
            'test-ready',
            { windowMs: 60_000, max: 2 },
            { getClient: () => fakeClient, alert: (a) => alerts.push(a) }
        );

        await withServer(limiter, async (url) => {
            const r1 = await fetch(url);
            const r2 = await fetch(url);
            const r3 = await fetch(url);
            assert.equal(r1.status, 200);
            assert.equal(r2.status, 200);
            assert.equal(r3.status, 429, 'Redis-backed limiter enforces max=2');
        });

        assert.deepEqual(alerts, [], 'no fallback reported while Redis is genuinely ready');
        const evalshaCalls = fakeClient._calls.filter(([cmd]) => String(cmd).toUpperCase() === 'EVALSHA');
        assert.ok(evalshaCalls.length >= 3, 'requests genuinely round-tripped through the fake Redis client, not the in-memory store');
    });

    test('a limiter built while Redis was not ready starts using Redis once it becomes ready (via the once("ready") hook)', async () => {
        const alerts = [];
        const fakeClient = makeFakeReadyClient();
        let readyCallback = null;
        const notReadyThenReadyClient = {
            status: 'connecting',
            once(event, cb) { if (event === 'ready') readyCallback = cb; },
        };

        const limiter = createResilientRateLimiter(
            'test-becomes-ready',
            { windowMs: 60_000, max: 5 },
            { getClient: () => notReadyThenReadyClient, alert: (a) => alerts.push(a) }
        );

        assert.ok(typeof readyCallback === 'function', 'registered a ready listener instead of building eagerly');

        // Simulate Redis becoming ready: flip status and fire the listener,
        // exactly like the real ioredis client would emit 'ready'.
        notReadyThenReadyClient.status = 'ready';
        // Swap the getClient the limiter sees at request time too, since our
        // fake needs real EVALSHA support once "ready" -- the important part
        // under test is that buildRedisLimiter() ran off the ready event, not
        // off a request.
        Object.assign(notReadyThenReadyClient, fakeClient);
        readyCallback();

        await withServer(limiter, async (url) => {
            const r = await fetch(url);
            assert.equal(r.status, 200);
        });

        assert.deepEqual(alerts, [], 'no fallback reported once Redis is ready and the limiter was built off the ready event');
        assert.ok(fakeClient._calls.some(([cmd]) => String(cmd).toUpperCase() === 'EVALSHA'), 'the request went through the Redis-backed store, not memory');
    });
});
