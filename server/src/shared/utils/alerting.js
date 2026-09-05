/**
 * alerting.js — real-time operational alerting.
 *
 * Purpose: push critical failures (uncaught exceptions, 5xx programming errors,
 * fraud/manual-review events) to a human in real time, instead of leaving them
 * to scroll past in a log stream or sit unseen in a database table. This is the
 * "push" complement to the existing "pull" surfaces (Winston logs + the
 * fraud_events / Detections tab).
 *
 * Design constraints (this module sits next to payment/order code):
 *   - NEVER throws. Every public function is wrapped so an alerting failure can
 *     never break, delay, or roll back the caller's transaction.
 *   - NON-BLOCKING. Callers fire-and-forget; the webhook POST has a short
 *     timeout and its rejection is swallowed.
 *   - NO-OP when unconfigured. With no ALERT_WEBHOOK_URL set, it only logs — so
 *     it is safe in every environment, including tests and local dev.
 *   - SECRET/PII SCRUBBING. Context is redacted before it ever leaves the
 *     process, so tokens, passwords, card data, phones and emails don't land in
 *     an ops channel.
 *   - STORM CONTROL. Identical alerts are de-duplicated within a short window so
 *     a crash loop or a burst of mismatches can't flood the channel.
 *
 * Destination is a generic incoming webhook (ALERT_WEBHOOK_URL). The body sends
 * both `text` (Slack / Google Chat / Mattermost) and `content` (Discord), so a
 * single payload works with the common chat-ops receivers; each ignores the key
 * it doesn't use.
 */
import axios from 'axios';
import logger from './logger.js';

const TIMEOUT_MS = 4000;
const MAX_BODY_CHARS = 3500;
const DEDUPE_WINDOW_MS = 60_000;
const RECENT_MAX = 500;
const STACK_LINES = 6;

// Redact anything whose KEY looks like a credential or direct PII. Kept
// deliberately broad; over-redaction in an ops alert is preferable to a leak,
// and the durable record (fraud_events / DB rows) still holds the full detail
// for whoever follows the ids in the alert.
// PII terms (phone/email/mpesa/msisdn) match as substrings so camelCase keys
// like `buyerEmail`/`buyerPhone` are caught; short, false-positive-prone tokens
// (pan/pin/cvv/otp — cf. "expand", "shipping") stay word-bounded.
const REDACT_KEY_RE = /(pass(word)?|secret|token|api[-_]?key|authoriz|bearer|cookie|creditcard|card[-_]?number|\bcvv\b|\bpan\b|\bpin\b|\botp\b|mpesa|msisdn|phone|email)/i;
const REDACTED = '[redacted]';

const recentAlerts = new Map(); // fingerprint -> last-sent epoch ms

function alertWebhookUrl() {
  return process.env.ALERT_WEBHOOK_URL || '';
}

function envLabel() {
  return process.env.ALERT_ENV_LABEL || process.env.NODE_ENV || 'unknown';
}

function serviceLabel() {
  return process.env.BYBLOS_PROCESS_ROLE || 'app';
}

/**
 * Recursively redact secret/PII-looking keys and cap size/depth so a large or
 * sensitive context object can never bloat or leak into the alert payload.
 */
export function scrubContext(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubContext(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = REDACT_KEY_RE.test(key) ? REDACTED : scrubContext(val, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  return value;
}

function fingerprint(title, message) {
  return `${title}::${String(message).slice(0, 120)}`;
}

// True if this alert should actually be sent (not a recent duplicate).
function passesDedupe(fp) {
  const now = Date.now();
  const last = recentAlerts.get(fp);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recentAlerts.set(fp, now);
  if (recentAlerts.size > RECENT_MAX) {
    for (const [key, ts] of recentAlerts) {
      if (now - ts > DEDUPE_WINDOW_MS) recentAlerts.delete(key);
    }
    if (recentAlerts.size > RECENT_MAX) recentAlerts.clear();
  }
  return true;
}

async function postWebhook(text) {
  const url = alertWebhookUrl();
  if (!url) return; // unconfigured -> log-only, no push
  try {
    await axios.post(url, { text, content: text }, { timeout: TIMEOUT_MS });
  } catch (err) {
    logger.warn('[alerting] webhook post failed', { error: err?.message });
  }
}

/**
 * Report a domain-level critical event (not necessarily a JS exception).
 * Always logs; pushes to the webhook when configured. Fire-and-forget: returns
 * a promise that always resolves and never rejects.
 *
 * @param {object} p
 * @param {'error'|'warn'} [p.level]
 * @param {string} p.title   short, stable label (used for de-duplication)
 * @param {string} p.message one-line human summary
 * @param {object} [p.context] structured detail (scrubbed before sending)
 */
export function reportAlert({ level = 'error', title = 'Alert', message = '', context = {} } = {}) {
  try {
    const safeContext = scrubContext(context) || {};
    const logFn = level === 'warn' ? logger.warn : logger.error;
    logFn.call(logger, `[ALERT] ${title}: ${message}`, safeContext);

    if (!passesDedupe(fingerprint(title, message))) return Promise.resolve();

    const emoji = level === 'warn' ? '⚠️' : '🚨';
    const contextStr = Object.keys(safeContext).length
      ? '\n```' + JSON.stringify(safeContext, null, 2).slice(0, MAX_BODY_CHARS) + '```'
      : '';
    const text = `${emoji} *[${envLabel()}/${serviceLabel()}] ${title}*\n${message}${contextStr}`;
    return postWebhook(text);
  } catch (err) {
    try { logger.warn('[alerting] reportAlert failed', { error: err?.message }); } catch { /* never throw */ }
    return Promise.resolve();
  }
}

/**
 * Report an error/exception. Always logs; pushes when configured.
 * Fire-and-forget: always resolves, never rejects.
 *
 * @param {unknown} error
 * @param {object} [context] extra fields (scrubbed); `context.title` overrides the alert title
 * @returns {Promise<void>}
 */
export function reportError(error, context = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const { title, ...rest } = context || {};
    return reportAlert({
      level: 'error',
      title: title || 'Unhandled error',
      message: `${err.name}: ${err.message}`,
      context: {
        ...rest,
        stack: String(err.stack || '').split('\n').slice(0, STACK_LINES).join('\n')
      }
    });
  } catch {
    return Promise.resolve();
  }
}

export default { reportError, reportAlert, scrubContext };
