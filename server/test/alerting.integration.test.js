// Real-behavior tests for the ops alerting module. Rather than mocking axios,
// this stands up a tiny local HTTP server as the webhook receiver, points
// ALERT_WEBHOOK_URL at it, and asserts the actual delivered payload — including
// that secrets/PII are scrubbed before they leave the process, that identical
// alerts are de-duplicated, and that an unconfigured module is a safe no-op.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const { reportAlert, reportError, scrubContext } = await import('../src/shared/utils/alerting.js');

let server;
let baseUrl;
let received; // captured POST bodies

before(async () => {
  received = [];
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { received.push(JSON.parse(raw)); } catch { received.push({ raw }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  delete process.env.ALERT_WEBHOOK_URL;
});

beforeEach(() => {
  received.length = 0;
  process.env.ALERT_WEBHOOK_URL = baseUrl;
});

describe('scrubContext (secret/PII redaction)', () => {
  test('redacts credential- and PII-looking keys, keeps safe fields', () => {
    const out = scrubContext({
      orderId: 42,
      amount: 1000,
      password: 'hunter2',
      apiKey: 'sk_live_abcdef',
      authorization: 'Bearer xyz',
      buyerEmail: 'someone@example.com',
      phone: '0712345678',
      mpesaReceipt: 'QX12',
      nested: { secretToken: 'zzz', keepMe: 'ok' }
    });
    assert.equal(out.orderId, 42);
    assert.equal(out.amount, 1000);
    assert.equal(out.password, '[redacted]');
    assert.equal(out.apiKey, '[redacted]');
    assert.equal(out.authorization, '[redacted]');
    assert.equal(out.buyerEmail, '[redacted]');
    assert.equal(out.phone, '[redacted]');
    assert.equal(out.mpesaReceipt, '[redacted]');
    assert.equal(out.nested.secretToken, '[redacted]');
    assert.equal(out.nested.keepMe, 'ok');
  });

  test('caps runaway depth rather than recursing forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
    const out = scrubContext(deep);
    // Something along the chain becomes the truncation sentinel.
    assert.match(JSON.stringify(out), /truncated/);
  });
});

describe('webhook delivery', () => {
  test('delivers a scrubbed alert and never leaks the secret value', async () => {
    await reportAlert({
      level: 'error',
      title: 'Delivery test unique-1',
      message: 'boom',
      context: { orderId: 7, password: 'TOP_SECRET_VALUE' }
    });

    assert.equal(received.length, 1, 'exactly one webhook POST');
    const body = received[0];
    // Slack/Google-Chat use `text`; Discord uses `content` — both are sent.
    assert.ok(body.text.includes('Delivery test unique-1'));
    assert.ok(body.text.includes('boom'));
    assert.equal(body.content, body.text);
    assert.ok(body.text.includes('"orderId": 7'), 'safe context is included');
    assert.ok(!body.text.includes('TOP_SECRET_VALUE'), 'the secret value must never appear in the payload');
    assert.ok(body.text.includes('[redacted]'), 'the secret is shown as redacted');
  });

  test('de-duplicates identical alerts within the window (storm control)', async () => {
    const alert = { level: 'error', title: 'Dedupe test unique-2', message: 'same message' };
    await reportAlert(alert);
    await reportAlert(alert);
    await reportAlert(alert);
    assert.equal(received.length, 1, 'identical alerts collapse to a single delivery');
  });

  test('reportError wraps a non-Error, includes a stack, and delivers', async () => {
    await reportError('a plain string failure unique-3', { title: 'String error unique-3', orderId: 9 });
    assert.equal(received.length, 1);
    assert.ok(received[0].text.includes('String error unique-3'));
    assert.ok(received[0].text.includes('stack'), 'a stack is attached even for non-Error inputs');
  });
});

describe('safety', () => {
  test('is a no-op (no throw, no POST) when ALERT_WEBHOOK_URL is unset', async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    await assert.doesNotReject(reportAlert({ title: 'Unconfigured unique-4', message: 'nope' }));
    assert.equal(received.length, 0, 'nothing is delivered when unconfigured');
  });

  test('never throws on garbage input', async () => {
    await assert.doesNotReject(reportAlert());
    await assert.doesNotReject(reportAlert({}));
    await assert.doesNotReject(reportError(undefined));
    await assert.doesNotReject(reportError({ circular: {} }));
  });
});
