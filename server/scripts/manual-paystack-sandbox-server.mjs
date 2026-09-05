/**
 * manual-paystack-sandbox-server.mjs
 *
 * ONE-OFF MANUAL VERIFICATION TOOL — not part of the automated test suite,
 * not run in CI. Boots the real, unmodified webhook route (same narrow
 * scope as the automated paystackWebhook.integration.test.js — see that
 * file for why the full app isn't booted) on PORT from .env.sandbox.test, so
 * a real Paystack test-mode webhook — delivered over the internet via a
 * tunnel, not simulated — can reach it and be processed by the real
 * production code path.
 *
 * Reads server/.env.sandbox.test (gitignored, holds REAL Paystack test-mode
 * keys) — deliberately NOT .env.test, which the automated suite uses with a
 * mock Paystack URL and must never make a real outbound call on every run.
 *
 * Usage: node scripts/manual-paystack-sandbox-server.mjs
 *    or: DOTENV_CONFIG_PATH=.env.sandbox.test node scripts/manual-paystack-sandbox-server.mjs
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env.sandbox.test'), override: true });

const webhookRoutes = (await import('../src/application/routes/webhook.routes.js')).default;
const logger = (await import('../src/shared/utils/logger.js')).default;

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use('/api/webhooks', webhookRoutes);
app.use((err, req, res, _next) => {
  logger.error('[MANUAL-SANDBOX] Unhandled error', { message: err.message });
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const port = Number(process.env.PORT) || 3003;
http.createServer(app).listen(port, () => {
  console.log(`[MANUAL-SANDBOX] Listening on http://localhost:${port} — mount the ngrok URL's /api/webhooks/paystack path as your Paystack test-mode webhook URL.`);
});
