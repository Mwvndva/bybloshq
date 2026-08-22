import test from 'node:test';
import assert from 'node:assert';

test('Test environment health check', () => {
  assert.strictEqual(process.env.NODE_ENV, 'test');
  assert.ok(process.env.DB_NAME, 'DB_NAME must be defined in test environment');
  assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be defined in test environment');
});
