/**
 * Unit tests for toJsonb and safeJson in order.utils.js
 * Run: node --test src/utils/__tests__/order.utils.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toJsonb, safeJson } from '../order.utils.js';

// ---------------------------------------------------------------------------
// toJsonb
// ---------------------------------------------------------------------------
test('toJsonb: null returns null', () => {
    assert.equal(toJsonb(null), null);
});

test('toJsonb: undefined returns null', () => {
    assert.equal(toJsonb(undefined), null);
});

test('toJsonb: plain object returns JSON string', () => {
    const result = toJsonb({ a: 1 });
    assert.equal(result, '{"a":1}');
});

test('toJsonb: array returns JSON string', () => {
    const result = toJsonb([1, 2, 3]);
    assert.equal(result, '[1,2,3]');
});

test('toJsonb: valid JSON string passes through unchanged', () => {
    const valid = '{"a":1}';
    assert.equal(toJsonb(valid), valid);
});

test('toJsonb: valid JSON array string passes through unchanged', () => {
    const valid = '[1,2,3]';
    assert.equal(toJsonb(valid), valid);
});

test('toJsonb: invalid JSON string THROWS (not silently double-encodes)', () => {
    assert.throws(
        () => toJsonb('not-json-at-all'),
        /Invalid JSON string passed to JSONB column/
    );
});

test('toJsonb: plain string "hello" THROWS', () => {
    assert.throws(
        () => toJsonb('hello'),
        /Invalid JSON string passed to JSONB column/
    );
});

test('toJsonb: number throws', () => {
    assert.throws(
        () => toJsonb(42),
        /Unsupported type/
    );
});

// ---------------------------------------------------------------------------
// safeJson
// ---------------------------------------------------------------------------
test('safeJson: valid JSON string parses to object', () => {
    const result = safeJson('{"a":1}');
    assert.deepEqual(result, { a: 1 });
});

test('safeJson: null returns empty object', () => {
    assert.deepEqual(safeJson(null), {});
});

test('safeJson: undefined returns empty object', () => {
    assert.deepEqual(safeJson(undefined), {});
});

test('safeJson: plain object returns as-is', () => {
    const obj = { x: 1 };
    assert.equal(safeJson(obj), obj); // same reference
});

test('safeJson: invalid JSON string returns {} (does NOT throw)', () => {
    // Should not throw — just return {}
    let result;
    assert.doesNotThrow(() => { result = safeJson('bad-json'); });
    assert.deepEqual(result, {});
});
