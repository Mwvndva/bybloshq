// Integration tests for GET /health/ready's Paystack reachability check.
//
// Audit finding: /health/ready checked the database (and reported Redis) but
// never Paystack, even though Paystack is the payment/payout provider this
// app can't actually take money through if it's unreachable or
// misconfigured -- a readiness probe that never looks at it means that state
// is invisible until a real buyer's payment fails.
//
// PaystackProviderClient reads PAYSTACK_BASE_URL/PAYSTACK_SECRET_KEY fresh in
// its constructor on every call (payment.service.js's checkBalance()
// constructs a new instance per call, doesn't cache one) -- so these tests
// mutate process.env directly between cases rather than needing to reload
// any module, same as how PAYSTACK_BASE_URL is already overridden for the
// local mock server in withdrawals.integration.test.js and
// paystackWebhook.integration.test.js.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import healthRoutes from '../src/application/routes/health.routes.js';

const MOCK_PORT = 3097;
let mockServer;
let mockShouldFail = false;

before(async () => {
    mockServer = http.createServer((req, res) => {
        if (mockShouldFail) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: false, message: 'error' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: true, data: [{ currency: 'KES', balance: 100000, ledger_balance: 100000 }] }));
    });
    await new Promise((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', resolve));
});

after(async () => {
    await new Promise((resolve) => mockServer.close(resolve));
});

let app;
let server;
let baseUrl;

before(async () => {
    app = express();
    app.use('/health', healthRoutes);
    server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

const ORIGINAL_SECRET = process.env.PAYSTACK_SECRET_KEY;
const ORIGINAL_BASE_URL = process.env.PAYSTACK_BASE_URL;

beforeEach(() => {
    mockShouldFail = false;
    process.env.PAYSTACK_SECRET_KEY = ORIGINAL_SECRET;
    process.env.PAYSTACK_BASE_URL = ORIGINAL_BASE_URL;
});

describe('GET /health/ready — Paystack reachability', () => {
    test('reports "connected" when Paystack responds successfully', async () => {
        process.env.PAYSTACK_SECRET_KEY = 'sk_test_healthcheck';
        process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;

        const res = await fetch(`${baseUrl}/health/ready`);
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.paystack, 'connected');
        // Not a hard gate: overall readiness still reflects DB, independent
        // of Paystack's own status.
        assert.equal(body.status, 'ready');
    });

    test('reports "disconnected" when Paystack is unreachable, without failing overall readiness', async () => {
        process.env.PAYSTACK_SECRET_KEY = 'sk_test_healthcheck';
        // Nothing is listening on this port.
        process.env.PAYSTACK_BASE_URL = 'http://127.0.0.1:39999';

        const res = await fetch(`${baseUrl}/health/ready`);
        const body = await res.json();

        assert.equal(res.status, 200, 'Paystack being down does not fail the whole readiness probe');
        assert.equal(body.status, 'ready');
        assert.equal(body.paystack, 'disconnected');
    });

    test('reports "disconnected" when Paystack responds with a failure status', async () => {
        process.env.PAYSTACK_SECRET_KEY = 'sk_test_healthcheck';
        process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`;
        mockShouldFail = true;

        const res = await fetch(`${baseUrl}/health/ready`);
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.paystack, 'disconnected');
    });

    test('reports "unconfigured" when PAYSTACK_SECRET_KEY is not set, without making a network call', async () => {
        delete process.env.PAYSTACK_SECRET_KEY;
        // Point at a port nothing listens on -- if this check actually made a
        // network call despite the missing key, it would come back
        // "disconnected", not "unconfigured", and this assertion would catch it.
        process.env.PAYSTACK_BASE_URL = 'http://127.0.0.1:39998';

        const res = await fetch(`${baseUrl}/health/ready`);
        const body = await res.json();

        assert.equal(res.status, 200);
        assert.equal(body.paystack, 'unconfigured');
    });
});
